package com.promptsurge.sdk.internal

import android.content.Context
import android.provider.Settings
import java.security.MessageDigest

/**
 * Stable per-device, per-app identifier used to attribute analytics events.
 *
 * Defined as `SHA-256(ANDROID_ID + applicationContext.packageName)` so the raw `ANDROID_ID`
 * is never persisted, transmitted, or logged. Hashing with the package name also prevents
 * cross-app correlation from a single hash. See conventions.md → "PII rules".
 */
internal object DeviceId {

    private var cached: String? = null

    fun get(context: Context): String {
        cached?.let { return it }
        @Suppress("HardwareIds")
        val androidId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID,
        ) ?: ""
        val pkg = context.packageName
        val digest = MessageDigest.getInstance("SHA-256")
            .digest((androidId + pkg).toByteArray(Charsets.UTF_8))
        val hex = digest.joinToString("") { "%02x".format(it) }
        cached = hex
        return hex
    }

    internal fun resetForTesting() {
        cached = null
    }
}
