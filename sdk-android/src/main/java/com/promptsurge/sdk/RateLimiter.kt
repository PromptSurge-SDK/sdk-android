package com.promptsurge.sdk

import android.content.Context
import android.content.SharedPreferences

internal class RateLimiter(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun canShow(): Boolean {
        val now = System.currentTimeMillis()
        val lastShownAt = prefs.getLong(KEY_LAST_SHOWN_AT, 0L)
        val lastDismissedAt = prefs.getLong(KEY_LAST_DISMISSED_AT, 0L)
        if (lastShownAt > 0 && now - lastShownAt < SHOWN_COOLDOWN_MS) return false
        if (lastDismissedAt > 0 && now - lastDismissedAt < DISMISSED_COOLDOWN_MS) return false
        return true
    }

    fun recordShown() {
        prefs.edit().putLong(KEY_LAST_SHOWN_AT, System.currentTimeMillis()).apply()
    }

    fun recordDismissed() {
        prefs.edit().putLong(KEY_LAST_DISMISSED_AT, System.currentTimeMillis()).apply()
    }

    fun reset() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "ps_rate_limiter"
        private const val KEY_LAST_SHOWN_AT = "last_shown_at"
        private const val KEY_LAST_DISMISSED_AT = "last_dismissed_at"

        internal const val SHOWN_COOLDOWN_MS = 90L * 24 * 60 * 60 * 1000    // 90 days
        internal const val DISMISSED_COOLDOWN_MS = 7L * 24 * 60 * 60 * 1000 // 7 days
    }
}
