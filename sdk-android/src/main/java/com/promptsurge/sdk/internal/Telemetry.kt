package com.promptsurge.sdk.internal

import android.content.Context
import android.content.pm.PackageManager
import com.promptsurge.sdk.BuildConfig
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant
import java.util.Locale
import java.util.UUID

/**
 * Thin façade in front of [EventBus] that owns session/device identity and the per-event
 * common fields (timestamp, appVersion, locale, …). Single source of truth for "what does an
 * event from this device look like" — keeps that knowledge out of [com.promptsurge.sdk.PromptSurge]
 * and out of the dialog fragment.
 */
internal class Telemetry private constructor(
    private val appContext: Context,
    private val bus: EventBus,
    private val sessionId: String,
    private val deviceId: String,
    private val appVersion: String,
) {

    fun fire(eventType: String, payload: JsonObject = buildJsonObject {}) {
        bus.enqueue(
            EventDto(
                eventType = eventType,
                eventId = UUID.randomUUID().toString(),
                timestamp = Instant.now().toString(),
                sessionId = sessionId,
                deviceId = deviceId,
                appVersion = appVersion,
                sdkVersion = BuildConfig.SDK_VERSION,
                locale = Locale.getDefault().toLanguageTag(),
                platform = "android",
            ).copy(payload = payload),
        )
    }

    /**
     * Fires `first_open` exactly once per device-install. Persistence is via SharedPreferences;
     * acts as our download proxy since SDKs can't see Play Store install events.
     */
    fun fireFirstOpenIfNeeded() {
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_FIRST_OPEN_FIRED, false)) return
        fire(EventTypes.FIRST_OPEN, buildJsonObject {})
        prefs.edit().putBoolean(KEY_FIRST_OPEN_FIRED, true).apply()
    }

    /** Test-only: clear the first_open flag so the next initialize() refires it. */
    internal fun resetFirstOpenForTesting() {
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().remove(KEY_FIRST_OPEN_FIRED).apply()
    }

    fun bus(): EventBus = bus

    companion object {
        private const val PREFS_NAME = "ps_telemetry"
        private const val KEY_FIRST_OPEN_FIRED = "first_open_fired"

        fun create(context: Context, apiKey: String, busOverride: EventBus? = null): Telemetry {
            val appCtx = context.applicationContext
            val bus = busOverride ?: EventBus.create(apiKey)
            bus.start(appCtx)
            return Telemetry(
                appContext = appCtx,
                bus = bus,
                sessionId = UUID.randomUUID().toString(),
                deviceId = DeviceId.get(appCtx),
                appVersion = readAppVersion(appCtx),
            )
        }

        private fun readAppVersion(ctx: Context): String = try {
            @Suppress("DEPRECATION")
            ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: "unknown"
        } catch (_: PackageManager.NameNotFoundException) {
            "unknown"
        }
    }
}
