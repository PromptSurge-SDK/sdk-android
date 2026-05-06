package com.promptsurge.sdk

import android.app.Dialog
import android.os.Bundle
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.FragmentActivity
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.promptsurge.sdk.internal.EventTypes
import com.promptsurge.sdk.internal.PromptDefaults
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Pre-prompt dialog shown before requesting a Play Store review.
 *
 * Design intent (do not change without reviewing App Store policy):
 * This dialog is purely informational — it does NOT gate the native review prompt on the user's
 * sentiment. Both buttons ("Sure" and "Not now") lead to the same outcome: the native prompt or
 * a neutral dismiss. There is no "Are you enjoying the app?" path that only shows the native
 * prompt to happy users. This design is intentional for Apple App Store rule 5.6.1 compatibility
 * so the eventual iOS port can reuse this exact UX without policy risk.
 */
internal class PrePromptDialogFragment : DialogFragment() {

    private var shownEventFired = false

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val cfg = listener ?: DefaultConfig
        return MaterialAlertDialogBuilder(requireContext())
            .setTitle(cfg.title)
            .setMessage(cfg.body)
            .setPositiveButton(cfg.ctaConfirm) { _, _ ->
                (requireActivity() as? FragmentActivity)?.let { listener?.onConfirmed(it) }
            }
            .setNegativeButton(cfg.ctaDismiss) { _, _ ->
                listener?.onDismissed()
            }
            .setCancelable(false)
            .create()
    }

    override fun onResume() {
        super.onResume()
        if (!shownEventFired) {
            shownEventFired = true
            val resolved = PromptSurge.promptRepo?.getCachedOrDefaults()?.locale
                ?: PromptDefaults.LOCALE
            PromptSurge.telemetry?.fire(
                EventTypes.PRE_PROMPT_SHOWN,
                buildJsonObject { put("resolvedLocale", resolved) },
            )
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

        internal var listener: DialogListener? = null

        fun newInstance(): PrePromptDialogFragment = PrePromptDialogFragment()

        private object DefaultConfig : DialogListener {
            override fun onConfirmed(activity: FragmentActivity) = Unit
            override fun onDismissed() = Unit
        }
    }
}
