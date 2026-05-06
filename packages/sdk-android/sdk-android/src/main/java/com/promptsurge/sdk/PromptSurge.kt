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

        val rateLimiter = RateLimiter(ctx)
        if (!rateLimiter.canShow()) {
            Log.d(TAG, "requestReview: rate-limited, skipping.")
            return
        }

        val manager = ReviewManagerFactory.create(ctx)
        val tel = telemetry
        val text: PromptText = promptRepo?.getCachedOrDefaults()
            ?: com.promptsurge.sdk.internal.PromptDefaults.asPromptText()
        val localePayload = buildJsonObject { put("resolvedLocale", text.locale) }

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
        appContext?.let { RateLimiter(it).reset() }
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
