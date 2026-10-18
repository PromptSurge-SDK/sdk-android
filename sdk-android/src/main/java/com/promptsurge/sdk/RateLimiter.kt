package com.promptsurge.sdk

import android.content.Context
import android.content.SharedPreferences

/**
 * The local gates on the review moment: the two pre-prompt cooldowns, and Google Play's own
 * review quota mirrored from the SDK's record of its native requests.
 *
 * **The quota.** Google does not publish it. Its in-app review guide says that calling the flow
 * more than once within a short period (for example, less than a month) may not show a dialog,
 * and Play never tells the app whether it showed one. Both stores warn against a button that
 * leads to the review API for exactly that reason: the tap can be answered by nothing. So the SDK
 * records every native request it makes and, inside [NATIVE_REQUEST_WINDOW_MS] of one, shows no
 * pre-prompt and makes no native call. What the record cannot see: review flows the host app
 * launches itself, and requests Play declined.
 *
 * @param clock epoch millis. Injectable so the tests can move time instead of waiting a month.
 */
internal class RateLimiter(
    context: Context,
    private val clock: () -> Long = System::currentTimeMillis,
) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun canShow(): Boolean {
        val now = clock()
        val lastShownAt = prefs.getLong(KEY_LAST_SHOWN_AT, 0L)
        val lastDismissedAt = prefs.getLong(KEY_LAST_DISMISSED_AT, 0L)
        if (lastShownAt > 0 && now - lastShownAt < SHOWN_COOLDOWN_MS) return false
        if (lastDismissedAt > 0 && now - lastDismissedAt < DISMISSED_COOLDOWN_MS) return false
        return true
    }

    fun recordShown() {
        prefs.edit().putLong(KEY_LAST_SHOWN_AT, clock()).apply()
    }

    fun recordDismissed() {
        prefs.edit().putLong(KEY_LAST_DISMISSED_AT, clock()).apply()
    }

    /**
     * When the SDK's own native requests have used up Play's quota, the epoch millis at which the
     * next one becomes possible. Null when a request is possible now.
     */
    fun quotaBlockedUntil(): Long? =
        nextPossibleRequest(nativeRequests(), clock(), NATIVE_REQUEST_LIMIT, NATIVE_REQUEST_WINDOW_MS)

    /**
     * Call on EVERY native review request the SDK makes - the confirm path and every path that
     * asks without a dialog (warm-up, impression limit, holdout). Keeps the last few entries only.
     */
    fun recordNativeRequest() {
        val kept = (nativeRequests() + clock()).takeLast(MAX_STORED_REQUESTS)
        prefs.edit().putString(KEY_NATIVE_REQUESTS, kept.joinToString(",")).apply()
    }

    /** The stored request timestamps, epoch millis, oldest first. */
    fun nativeRequests(): List<Long> =
        prefs.getString(KEY_NATIVE_REQUESTS, null)
            ?.split(',')
            ?.mapNotNull { it.trim().toLongOrNull() }
            ?: emptyList()

    /** Clears the cooldowns AND the quota record. Debug and tests only. */
    fun reset() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "ps_rate_limiter"
        private const val KEY_LAST_SHOWN_AT = "last_shown_at"
        private const val KEY_LAST_DISMISSED_AT = "last_dismissed_at"
        internal const val KEY_NATIVE_REQUESTS = "native_review_requests"

        internal const val SHOWN_COOLDOWN_MS = 90L * 24 * 60 * 60 * 1000    // 90 days
        internal const val DISMISSED_COOLDOWN_MS = 7L * 24 * 60 * 60 * 1000 // 7 days

        /** Native requests allowed inside [NATIVE_REQUEST_WINDOW_MS]. */
        internal const val NATIVE_REQUEST_LIMIT = 1
        internal const val NATIVE_REQUEST_WINDOW_MS = 30L * 24 * 60 * 60 * 1000 // 30 days
        internal const val MAX_STORED_REQUESTS = 5

        /**
         * Pure, so the rule can be tested without a clock or prefs. With `k` requests inside the
         * window and a limit of `n`, the count drops below `n` when the request at position
         * `k - n` (oldest first) ages out.
         */
        internal fun nextPossibleRequest(requests: List<Long>, now: Long, limit: Int, windowMs: Long): Long? {
            val recent = requests.filter { now - it < windowMs }.sorted()
            if (recent.size < limit) return null
            return recent[recent.size - limit] + windowMs
        }
    }
}
