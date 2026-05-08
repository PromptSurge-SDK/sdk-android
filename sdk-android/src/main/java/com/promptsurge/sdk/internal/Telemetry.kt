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
 * Thin façade in front of [EventBus] that owns session/device identity, the per-event
 * common fields, and holdout group assignment.
 *
 * Holdout assignment:
 *   - Assigned once on first [create] call, persisted in SharedPreferences.
 *   - 10% of installs are placed in the holdout group.
 *   - All events from a holdout device carry holdout=true, allowing the API to compute
 *     natural (no pre-prompt) native review rates as a baseline.
 */
internal class Telemetry private constructor(
    private val appContext: Context,
    private val bus: EventBus,
    private val sessionId: String,
    private val deviceId: String,
    private val appVersion: String,
    private val inHoldout: Boolean,
) {

    fun isInHoldout(): Boolean = inHoldout

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
                holdout = inHoldout,
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
        private const val KEY_HOLDOUT_ASSIGNED = "holdout_assigned"
        private const val KEY_IN_HOLDOUT = "in_holdout"
        private const val HOLDOUT_RATE = 0.10 // 10% of installs

        fun create(context: Context, apiKey: String, busOverride: EventBus? = null): Telemetry {
            val appCtx = context.applicationContext
            val bus = busOverride ?: EventBus.create(apiKey)
            bus.start(appCtx)

            val prefs = appCtx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val inHoldout = if (prefs.getBoolean(KEY_HOLDOUT_ASSIGNED, false)) {
                prefs.getBoolean(KEY_IN_HOLDOUT, false)
            } else {
                val assigned = Math.random() < HOLDOUT_RATE
                prefs.edit()
                    .putBoolean(KEY_HOLDOUT_ASSIGNED, true)
                    .putBoolean(KEY_IN_HOLDOUT, assigned)
                    .apply()
                assigned
            }

            return Telemetry(
                appContext = appCtx,
                bus = bus,
                sessionId = UUID.randomUUID().toString(),
                deviceId = DeviceId.get(appCtx),
                appVersion = readAppVersion(appCtx),
                inHoldout = inHoldout,
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
