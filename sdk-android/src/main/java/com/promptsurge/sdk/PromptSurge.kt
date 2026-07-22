package com.promptsurge.sdk

import android.content.Context
import androidx.fragment.app.FragmentActivity
import com.google.android.play.core.review.ReviewManagerFactory
import com.promptsurge.sdk.internal.EventTypes
import com.promptsurge.sdk.internal.PromptText
import com.promptsurge.sdk.internal.PromptTextRepository
import com.promptsurge.sdk.internal.PsLog
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
    private const val KEY_PREFIX = "ps_live_"

    private var apiKey: String? = null
    private var appContext: Context? = null
    @Volatile internal var telemetry: Telemetry? = null
    @Volatile internal var promptRepo: PromptTextRepository? = null

    /** How much the SDK logs. See [setLogLevel]. */
    enum class LogLevel {
        /** Nothing at all, including errors. Opt-in only. */
        NONE,

        /** Errors only. */
        ERROR,

        /** Errors and warnings. The default. */
        WARN,

        /** Adds one line per significant decision (rate-limited, holdout, warm-up, ...). */
        INFO,

        /** Adds delivery detail: cache hits, fetch outcomes, event queueing. */
        DEBUG,
    }

    /**
     * Set how much the SDK logs. Defaults to [LogLevel.WARN] — errors and warnings only.
     *
     * Raise it to [LogLevel.INFO] or [LogLevel.DEBUG] while integrating to see why a pre-prompt
     * did or did not appear. The SDK never logs the API key.
     */
    fun setLogLevel(level: LogLevel) {
        PsLog.level = when (level) {
            LogLevel.NONE -> PsLog.Level.NONE
            LogLevel.ERROR -> PsLog.Level.ERROR
            LogLevel.WARN -> PsLog.Level.WARN
            LogLevel.INFO -> PsLog.Level.INFO
            LogLevel.DEBUG -> PsLog.Level.DEBUG
        }
    }

    /**
     * Initialize the SDK. Must be called before [requestReview].
     *
     * Safe to call multiple times with the same key (idempotent).
     *
     * A blank key is rejected outright: the SDK stays uninitialized and [requestReview] is a
     * no-op, rather than silently showing bundled English copy the developer never wrote.
     *
     * @param verifyToken optional one-shot app-ownership token from the PromptSurge dashboard's
     *   Verify page. It rides along with the next event batch and can be removed from your code
     *   once the dashboard shows the app as verified.
     *
     * @throws IllegalStateException if called a second time with a *different* API key.
     */
    @JvmOverloads
    fun initialize(context: Context, apiKey: String, verifyToken: String? = null) {
        val key = validateKey(apiKey) ?: return
        when {
            this.apiKey == null -> {
                this.apiKey = key
                this.appContext = context.applicationContext
                PsLog.i(TAG, "Initialized.")
                val tel = Telemetry.create(context, key)
                this.telemetry = tel
                verifyToken?.takeIf { it.isNotBlank() }?.let { tel.bus().verifyToken = it.trim() }
                tel.fire(EventTypes.INITIALIZE)
                tel.fireFirstOpenIfNeeded()

                val repo = PromptTextRepository.create(context, key)
                this.promptRepo = repo
                repo.prefetch()
            }
            this.apiKey == key -> {
                PsLog.w(TAG, "initialize() called again with the same key — ignoring.")
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
     * Returns the key to use, or null if it is unusable. Whitespace is trimmed rather than
     * rejected — a key pasted out of a web page with a trailing newline is a typo, not a
     * different key, and failing it would send the integrator hunting server-side.
     */
    private fun validateKey(apiKey: String): String? {
        val trimmed = apiKey.trim()
        if (trimmed.isEmpty()) {
            PsLog.e(
                TAG,
                "initialize() was given a blank API key — the SDK is NOT initialized and no " +
                    "pre-prompt will be shown. Pass the key from your PromptSurge dashboard " +
                    "(it starts with \"$KEY_PREFIX\").",
            )
            return null
        }
        if (trimmed != apiKey) {
            PsLog.w(TAG, "API key had leading/trailing whitespace — trimmed.")
        }
        if (!trimmed.startsWith(KEY_PREFIX)) {
            PsLog.w(
                TAG,
                "API key does not start with \"$KEY_PREFIX\". Check you copied an Android key " +
                    "from the PromptSurge dashboard; the server will reject anything else.",
            )
        }
        return trimmed
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
            PsLog.e(
                TAG,
                "requestReview() called before initialize() — ignoring. Call " +
                    "PromptSurge.initialize(context, apiKey) from Application.onCreate().",
            )
            return
        }

        // The documented call site is an async "level complete" callback, which is exactly when
        // the activity may already be going away or have saved its state. Showing a
        // DialogFragment then throws IllegalStateException and takes the host app down with it.
        if (activity.isFinishing || activity.isDestroyed) {
            PsLog.i(TAG, "requestReview: activity is finishing or destroyed, skipping.")
            return
        }
        val fm = activity.supportFragmentManager
        if (fm.isStateSaved) {
            PsLog.i(TAG, "requestReview: fragment state already saved, skipping.")
            return
        }
        if (fm.findFragmentByTag(PrePromptDialogFragment.TAG) != null) {
            PsLog.i(TAG, "requestReview: pre-prompt already showing, skipping.")
            return
        }

        if (isOptedOut(ctx)) {
            PsLog.i(TAG, "requestReview: user opted out, skipping.")
            return
        }

        val rateLimiter = RateLimiter(ctx)
        if (!rateLimiter.canShow()) {
            PsLog.i(TAG, "requestReview: rate-limited, skipping.")
            return
        }

        // API key was rejected by the server this session — showing bundled English copy in that
        // state hides a broken install behind something that looks like it works.
        if (promptRepo?.isUnauthorized() == true) {
            PsLog.e(
                TAG,
                "requestReview: the server rejected this API key (401/403). No pre-prompt will " +
                    "be shown. Check the key in your PromptSurge dashboard is an Android key " +
                    "and is active.",
            )
            return
        }

        // App was soft-deleted server-side — suppress pre-prompt entirely.
        if (promptRepo?.isAppDeleted() == true) {
            PsLog.i(TAG, "requestReview: app deleted server-side, suppressing pre-prompt.")
            return
        }

        val manager = ReviewManagerFactory.create(ctx)
        val tel = telemetry

        // Warm-up phase: app hasn't yet accumulated enough distinct-device events.
        // Fire native review so the event is counted toward the threshold.
        if (promptRepo?.isWarmupActive() == true) {
            PsLog.i(TAG, "requestReview: warm-up phase — skipping dialog, firing native review for baseline.")
            manager.requestReviewFlow().addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    manager.launchReviewFlow(activity, task.result)
                        .addOnCompleteListener {
                            tel?.fire(EventTypes.NATIVE_PROMPT_REQUESTED)
                            rateLimiter.recordShown()
                        }
                } else {
                    PsLog.w(TAG, "requestReviewFlow (warmup) failed: ${task.exception?.message}")
                    rateLimiter.recordShown()
                }
            }
            return
        }

        // Impression limit reached — skip pre-prompt, fire native IAR directly.
        if (promptRepo?.isImpressionLimitExceeded() == true) {
            PsLog.i(TAG, "requestReview: impression limit exceeded — skipping dialog, attempting native IAR.")
            manager.requestReviewFlow().addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    manager.launchReviewFlow(activity, task.result)
                        .addOnCompleteListener {
                            tel?.fire(EventTypes.NATIVE_PROMPT_REQUESTED)
                            rateLimiter.recordShown()
                        }
                } else {
                    PsLog.w(TAG, "requestReviewFlow (impression limit) failed: ${task.exception?.message}")
                    rateLimiter.recordShown()
                }
            }
            return
        }

        // Holdout group — skip the pre-prompt dialog but still attempt the native IAR
        // so we can measure the natural review rate as a baseline.
        if (tel?.isInHoldout() == true) {
            PsLog.i(TAG, "requestReview: holdout group — skipping dialog, attempting native IAR.")
            manager.requestReviewFlow().addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    manager.launchReviewFlow(activity, task.result)
                        .addOnCompleteListener {
                            tel.fire(EventTypes.NATIVE_PROMPT_REQUESTED)
                            rateLimiter.recordShown()
                        }
                } else {
                    PsLog.w(TAG, "requestReviewFlow (holdout) failed: ${task.exception?.message}")
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
            // Only sent when the server actually served a row. Never invented, so the field
            // lights up by itself the moment the server starts returning it.
            text.promptId?.let { put("promptId", it) }
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
                        PsLog.w(TAG, "requestReviewFlow failed: ${requestTask.exception?.message}")
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
        PsLog.i(TAG, "User opted out of review prompts.")
    }

    /**
     * Re-enable pre-prompt dialogs for this user after a previous [optOut] call.
     */
    fun optIn(context: Context) {
        context.applicationContext
            .getSharedPreferences(OPT_OUT_PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(OPT_OUT_KEY, false).apply()
        PsLog.i(TAG, "User opted back in to review prompts.")
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
