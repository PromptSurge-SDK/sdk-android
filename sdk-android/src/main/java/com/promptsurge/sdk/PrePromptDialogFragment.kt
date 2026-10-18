package com.promptsurge.sdk

import android.app.Dialog
import android.content.Context
import android.content.DialogInterface
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.ContextThemeWrapper
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.FragmentActivity
import coil.load
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.promptsurge.sdk.internal.EventTypes
import com.promptsurge.sdk.internal.PromptDefaults
import com.promptsurge.sdk.internal.PsLog
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Pre-prompt dialog shown before requesting a Play Store review.
 *
 * Design intent (do not change without reviewing App Store policy):
 * The two buttons do NOT lead to the same outcome. "Sure" opens Play's in-app review flow;
 * "Not now" records a cooldown and fires `pre_prompt_dismissed`, and no native sheet is shown.
 * That asymmetry is a deliberate product decision (Fäden card 67, 2026-07-22): a user who says
 * "not now" is answering the question, and firing the rating sheet at them anyway works against
 * that answer.
 *
 * The consequence is that **the copy carries the policy risk.** With a call to action (the
 * default is the statement "A quick favor") the dialog is an ordinary ask that the user can
 * decline. With a satisfaction question ("Are you enjoying the app?") the same asymmetry becomes
 * a sentiment filter routing only happy users to the store - the pattern Apple rule 5.6.1 and Google Play's
 * in-app review policy address. Server-served copy must stay a call to action; see the
 * generation rules in `apps/api/src/llm/system-prompts.ts`.
 */
internal class PrePromptDialogFragment : DialogFragment() {

    private var shownEventFired = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Survives rotation: without this the billable pre_prompt_shown impression fires again
        // on every configuration change while the dialog is up.
        shownEventFired = savedInstanceState?.getBoolean(STATE_SHOWN_EVENT_FIRED, false) ?: false
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(STATE_SHOWN_EVENT_FIRED, shownEventFired)
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val cfg = listener ?: DefaultConfig
        val promptData = PromptSurge.promptRepo?.getCachedOrDefaults()
        val imageUrl = promptData?.imageUrl
        val ctx = materialContext()

        val builder = MaterialAlertDialogBuilder(ctx)
            .setTitle(cfg.title)
            .setMessage(cfg.body)
            .setPositiveButton(cfg.ctaConfirm) { _, _ ->
                (requireActivity() as? FragmentActivity)?.let { listener?.onConfirmed(it) }
            }
            .setNegativeButton(cfg.ctaDismiss) { _, _ ->
                listener?.onDismissed()
            }
            .setCancelable(false)

        // When an imageUrl is available, add a header image above the dialog content.
        if (!imageUrl.isNullOrBlank()) {
            val imageView = ImageView(ctx).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    resources.getDimensionPixelSize(android.R.dimen.notification_large_icon_height) * 3,
                )
                scaleType = ImageView.ScaleType.CENTER_CROP
                // Coil loads the image and falls back silently on failure (dialog still shows).
                load(imageUrl)
            }
            builder.setCustomTitle(imageView)
        }

        return builder.create()
    }

    /**
     * The context to build the dialog against.
     *
     * A Material host theme is used as-is, so the dialog inherits the host's shape and colour
     * roles. A non-Material host theme (plain AppCompat, platform, or a custom game theme) would
     * make [MaterialAlertDialogBuilder] throw, so those are wrapped in the SDK's own Material
     * theme instead.
     */
    private fun materialContext(): Context {
        val ctx = requireContext()
        val value = TypedValue()
        val isMaterialHost = ctx.theme.resolveAttribute(
            com.google.android.material.R.attr.materialAlertDialogTheme,
            value,
            true,
        ) && value.data != 0
        if (isMaterialHost) return ctx
        PsLog.i(
            TAG,
            "Host theme is not a Material theme; using the SDK's bundled dialog theme.",
        )
        return ContextThemeWrapper(ctx, R.style.Theme_PromptSurge_MaterialDialogHost)
    }

    override fun onStart() {
        super.onStart()
        val theme = PromptSurge.promptRepo?.getCachedOrDefaults()?.theme ?: return
        if (theme.presetId == "default") return

        val alertDialog = dialog as? AlertDialog ?: return
        runCatching {
            val bgColor = Color.parseColor(theme.backgroundColor)
            val accentColor = Color.parseColor(theme.accentColor)
            val textColor = Color.parseColor(theme.textColor)
            val btnTextColor = Color.parseColor(theme.buttonTextColor)

            // Dialog window background: rounded rectangle matching Material3 dialog shape (28dp)
            val cornerPx = (28f * resources.displayMetrics.density)
            val bgDrawable = GradientDrawable().apply {
                setColor(bgColor)
                cornerRadius = cornerPx
            }
            alertDialog.window?.setBackgroundDrawable(bgDrawable)

            // Positive button: filled accent
            alertDialog.getButton(DialogInterface.BUTTON_POSITIVE)?.apply {
                setTextColor(btnTextColor)
                setBackgroundColor(accentColor)
            }

            // Negative button: text-only in accent color
            alertDialog.getButton(DialogInterface.BUTTON_NEGATIVE)?.setTextColor(accentColor)

            // Title text color
            val titleId = resources.getIdentifier("alertTitle", "id", "android")
            alertDialog.findViewById<TextView>(titleId)?.setTextColor(textColor)

            // Message text color
            alertDialog.findViewById<TextView>(android.R.id.message)?.setTextColor(textColor)
        }
        // Silently swallow any theming error - the dialog still shows with default styling.
    }

    override fun onResume() {
        super.onResume()
        if (!shownEventFired) {
            shownEventFired = true
            val served = PromptSurge.promptRepo?.getCachedOrDefaults()
            PromptSurge.telemetry?.fire(
                EventTypes.PRE_PROMPT_SHOWN,
                buildJsonObject {
                    put("resolvedLocale", served?.locale ?: PromptDefaults.LOCALE)
                    // pre_prompt_shown is the billable event and the denominator of every
                    // conversion rate, so it needs the same attribution as confirm/dismiss.
                    served?.promptNumber?.let { put("servedPromptNumber", it) }
                    served?.promptId?.let { put("promptId", it) }
                },
            )
            // Record the 90-day cooldown here rather than on a button tap. The dialog is
            // setCancelable(false), so a user who swipes the app away never taps either button;
            // recording only on tap left that user eligible again immediately, forever.
            context?.let { RateLimiter(it).recordShown() }
        }
    }

    internal interface DialogListener {
        val title: String get() = PromptDefaults.TITLE
        val body: String get() = PromptDefaults.BODY
        val ctaConfirm: String get() = PromptDefaults.CTA_CONFIRM
        val ctaDismiss: String get() = PromptDefaults.CTA_DISMISS
        fun onConfirmed(activity: FragmentActivity)
        fun onDismissed()
    }

    companion object {
        const val TAG = "PromptSurgePrePrompt"

        private const val STATE_SHOWN_EVENT_FIRED = "ps_shown_event_fired"

        internal var listener: DialogListener? = null

        fun newInstance(): PrePromptDialogFragment = PrePromptDialogFragment()

        private object DefaultConfig : DialogListener {
            override fun onConfirmed(activity: FragmentActivity) = Unit
            override fun onDismissed() = Unit
        }
    }
}
