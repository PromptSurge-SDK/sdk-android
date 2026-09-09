package com.promptsurge.sdk.internal

import android.content.Context
import android.content.pm.PackageManager
import com.promptsurge.sdk.BuildConfig
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
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
 *   - **Card 349 phase 4: the SERVER is the authority from the second session onwards.**
 *     SharedPreferences do not survive an uninstall but `deviceId` does, so a local-only flip
 *     re-rolls a reinstalling device into a new group and counts it in both. `POST /v1/events`
 *     answers with the group the server remembers, and [create] persists that answer over the
 *     local one. **It is applied on the NEXT [create], never mid-session** - see [inHoldout].
 */
internal class Telemetry private constructor(
    private val appContext: Context,
    private val bus: EventBus,
    private val sessionId: String,
    private val deviceId: String,
    private val appVersion: String,
    /**
     * Fixed for the life of this instance, on purpose. The server's answer arrives on a flush,
     * which can land at any point in a session; adopting it immediately would mean the same
     * session showed the pre-prompt to a user before the flush and skipped it afterwards, and
     * the events either side would describe two different experiences under one session id.
     * Persisting it and reading it at the next [create] costs one session of staleness and
     * keeps every session internally coherent.
     */
    private val inHoldout: Boolean,
) {

    fun isInHoldout(): Boolean = inHoldout

    fun fire(eventType: String, payload: JsonObject = buildJsonObject {}) {
        bus.enqueue(
            EventDto(
                eventType = eventType,
                eventId = UUID.randomUUID().toString(),
                timestamp = nowIso8601(),
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
        /**
         * ISO-8601 UTC, matching what the server's Zod schema accepts
         * (`z.string().datetime({ offset: true })`).
         *
         * Deliberately NOT `java.time.Instant`: `java.time` is API 26+, the SDK declares
         * `minSdk 24`, and core-library desugaring is not enabled — so an `Instant.now()` here
         * crashes the host app on launch on API 24/25, because this runs from `initialize()`.
         * `SimpleDateFormat` is not thread-safe, hence the per-thread instance.
         */
        private val iso8601 = object : ThreadLocal<SimpleDateFormat>() {
            override fun initialValue(): SimpleDateFormat =
                SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
        }

        internal fun nowIso8601(): String = iso8601.get()!!.format(Date())

        private const val PREFS_NAME = "ps_telemetry"
        private const val KEY_FIRST_OPEN_FIRED = "first_open_fired"
        private const val KEY_HOLDOUT_ASSIGNED = "holdout_assigned"
        private const val KEY_IN_HOLDOUT = "in_holdout"

        /**
         * Card 349 phase 4. Written the first time the server answers with an assignment, and
         * never cleared. It is not read by the SDK - it exists so that a support session
         * looking at a device's prefs can tell a locally flipped coin from the server's memory,
         * which is the difference between "this device has never been seen" and "this device
         * has an assignment and the SDK is honouring it".
         */
        private const val KEY_HOLDOUT_FROM_SERVER = "holdout_from_server"
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

            // Card 349 phase 4: adopt the server's memory for the NEXT session. Writing only on
            // a change keeps this off the disk on every flush of every session, and the commit
            // is async because nothing in this process reads it again.
            bus.onAssignment = { serverHoldout ->
                val current = appCtx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                if (!current.getBoolean(KEY_HOLDOUT_FROM_SERVER, false) ||
                    current.getBoolean(KEY_IN_HOLDOUT, false) != serverHoldout
                ) {
                    current.edit()
                        .putBoolean(KEY_HOLDOUT_ASSIGNED, true)
                        .putBoolean(KEY_IN_HOLDOUT, serverHoldout)
                        .putBoolean(KEY_HOLDOUT_FROM_SERVER, true)
                        .apply()
                    PsLog.d(
                        "PromptSurgeTelemetry",
                        "Holdout group adopted from server: $serverHoldout (applies next session)",
                    )
                }
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
