package com.promptsurge.sdk

import android.content.Context
import android.util.Log
import androidx.fragment.app.FragmentActivity
import com.google.android.play.core.review.ReviewManagerFactory
import com.promptsurge.sdk.internal.EventTypes
import com.promptsurge.sdk.internal.PromptText
import com.promptsurge.sdk.internal.PromptTextRepository
import com.promptsurge.sdk.internal.Telemetry
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Main entry point for the PromptSurge SDK.
 *
 * Usage:
 *   1. Call [initialize] once in Application.onCreate or your launcher Activity.onCreate.
 *   2. Call [requestReview] at a natural high-satisfaction moment in the user journey.
 */
object PromptSurge {

    private const val TAG = "PromptSurge"
    private const val OPT_OUT_PREFS = "ps_opt_out"
    private const val OPT_OUT_KEY = "opted_out"

    // TODO(M4): validate apiKey against backend on first initialize()
    private var apiKey: String? = null
    private var appContext: Context? = null
    @Volatile internal var telemetry: Telemetry? = null
    @Volatile internal var promptRepo: PromptTextRepository? = null

    /**
     * Initialize the SDK. Must be called before [requestReview].
     *
     * Safe to call multiple times with the same key (idempotent).
     *
     * @throws IllegalStateException if called a second time with a *different* API key.
     */
    fun initialize(context: Context, apiKey: String) {
        when {
            this.apiKey == null -> {
                this.apiKey = apiKey
                this.appContext = context.applicationContext
                Log.d(TAG, "Initialized with key …${apiKey.takeLast(4)}")
                val tel = Telemetry.create(context, apiKey)
                this.telemetry = tel
                tel.fire(EventTypes.INITIALIZE)
                tel.fireFirstOpenIfNeeded()

                val repo = PromptTextRepository.create(context, apiKey)
                this.promptRepo = repo
                repo.prefetch()
            }
            this.apiKey == apiKey -> {
                Log.w(TAG, "initialize() called again with the same key — ignoring.")
            }
            else -> {
                throw IllegalStateException(
                    "PromptSurge is already initialized with a different API key. " +
                        "Call initialize() only once per process.",
                )
            }
        }
    }

    /**
     * Show the pre-prompt dialog and, if the user confirms, launch the Play In-App Review flow.
     *
     * No-op if:
     *  - [initialize] has not been called yet.
     *  - The user was shown the dialog within the last 90 days.
     *  - The user dismissed ("Not now") within the last 7 days.
     */
    fun requestReview(activity: FragmentActivity) {
        val ctx = appContext ?: run {
            Log.e(TAG, "requestReview() called before initialize() — ignoring.")
            return
        }

        if (isOptedOut(ctx)) {
            Log.d(TAG, "requestReview: user opted out, skipping.")
            return
        }

        val rateLimiter = RateLimiter(ctx)
        if (!rateLimiter.canShow()) {
            Log.d(TAG, "requestReview: rate-limited, skipping.")
            return
        }

        // App was soft-deleted server-side — suppress pre-prompt entirely.
        if (promptRepo?.isAppDeleted() == true) {
            Log.d(TAG, "requestReview: app deleted server-side, suppressing pre-prompt.")
            return
        }

        val manager = ReviewManagerFactory.create(ctx)
        val tel = telemetry

        // Impression limit reached — skip pre-prompt, fire native IAR directly.
        if (promptRepo?.isImpressionLimitExceeded() == true) {
            Log.d(TAG, "requestReview: impression limit exceeded — skipping dialog, attempting native IAR.")
            manager.requestReviewFlow().addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    manager.launchReviewFlow(activity, task.result)
                        .addOnCompleteListener {
                            tel?.fire(EventTypes.NATIVE_PROMPT_REQUESTED)
                            rateLimiter.recordShown()
                        }
                } else {
                    Log.w(TAG, "requestReviewFlow (impression limit) failed: ${task.exception?.message}")
                    rateLimiter.recordShown()
                }
            }
            return
        }

        // Holdout group — skip the pre-prompt dialog but still attempt the native IAR
        // so we can measure the natural review rate as a baseline.
        if (tel?.isInHoldout() == true) {
            Log.d(TAG, "requestReview: holdout group — skipping dialog, attempting native IAR.")
            manager.requestReviewFlow().addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    manager.launchReviewFlow(activity, task.result)
                        .addOnCompleteListener {
                            tel.fire(EventTypes.NATIVE_PROMPT_REQUESTED)
                            rateLimiter.recordShown()
                        }
                } else {
                    Log.w(TAG, "requestReviewFlow (holdout) failed: ${task.exception?.message}")
                    rateLimiter.recordShown()
                }
            }
            return
        }

        val text: PromptText = promptRepo?.getCachedOrDefaults()
            ?: com.promptsurge.sdk.internal.PromptDefaults.asPromptText()
        val localePayload = buildJsonObject {
            put("resolvedLocale", text.locale)
            text.promptNumber?.let { put("servedPromptNumber", it) }
        }

        PrePromptDialogFragment.listener = object : PrePromptDialogFragment.DialogListener {
            override val title: String = text.title
            override val body: String = text.body
            override val ctaConfirm: String = text.ctaConfirm
            override val ctaDismiss: String = text.ctaDismiss

            override fun onConfirmed(activity: FragmentActivity) {
                tel?.fire(EventTypes.PRE_PROMPT_CONFIRMED, localePayload)
                manager.requestReviewFlow().addOnCompleteListener { requestTask ->
                    if (requestTask.isSuccessful) {
                        manager.launchReviewFlow(activity, requestTask.result)
                            .addOnCompleteListener {
                                tel?.fire(EventTypes.NATIVE_PROMPT_REQUESTED, localePayload)
                                rateLimiter.recordShown()
                                PrePromptDialogFragment.listener = null
                            }
                    } else {
                        Log.w(TAG, "requestReviewFlow failed: ${requestTask.exception?.message}")
                        rateLimiter.recordShown()
                        PrePromptDialogFragment.listener = null
                    }
                }
            }

            override fun onDismissed() {
                tel?.fire(EventTypes.PRE_PROMPT_DISMISSED, localePayload)
                rateLimiter.recordDismissed()
                PrePromptDialogFragment.listener = null
            }
        }

        PrePromptDialogFragment.newInstance()
            .show(activity.supportFragmentManager, PrePromptDialogFragment.TAG)
    }

    /**
     * Opt this user out of all PromptSurge pre-prompt dialogs permanently (until [optIn] is called).
     * The preference is persisted across launches. Safe to call before [initialize].
     *
     * Use this to honour a user's explicit "don't ask me for reviews" preference.
     */
    fun optOut(context: Context) {
        context.applicationContext
            .getSharedPreferences(OPT_OUT_PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(OPT_OUT_KEY, true).apply()
        Log.d(TAG, "User opted out of review prompts.")
    }

    /**
     * Re-enable pre-prompt dialogs for this user after a previous [optOut] call.
     */
    fun optIn(context: Context) {
        context.applicationContext
            .getSharedPreferences(OPT_OUT_PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(OPT_OUT_KEY, false).apply()
        Log.d(TAG, "User opted back in to review prompts.")
    }

    private fun isOptedOut(context: Context): Boolean =
        context.getSharedPreferences(OPT_OUT_PREFS, Context.MODE_PRIVATE)
            .getBoolean(OPT_OUT_KEY, false)

    /**
     * Override the device locale used to fetch prompt copy. Pass `null` to clear and revert
     * to `Locale.getDefault()`. Triggers a background refresh.
     *
     * Intended for debug + per-user-preference toggling. Persisted across launches.
     */
    fun setLocaleOverride(locale: String?) {
        promptRepo?.also {
            it.setLocaleOverride(locale)
            it.prefetch()
        }
    }

    /**
     * Clear the rate-limit timestamps so the pre-prompt can be shown again immediately.
     *
     * Intended for debug builds and UI testing only. Do not call in production.
     */
    fun clearRateLimitForTesting() {
        appContext?.let { RateLimiter(it).reset() }
    }

    /** Visible for testing only — resets all internal SDK state. */
    internal fun reset() {
        appContext?.let {
            RateLimiter(it).reset()
            it.getSharedPreferences(OPT_OUT_PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        }
        telemetry?.bus()?.stop()
        telemetry?.resetFirstOpenForTesting()
        promptRepo?.resetForTesting()
        telemetry = null
        promptRepo = null
        apiKey = null
        appContext = null
        PrePromptDialogFragment.listener = null
    }
}
