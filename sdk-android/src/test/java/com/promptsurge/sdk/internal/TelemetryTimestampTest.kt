package com.promptsurge.sdk.internal

import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The timestamp format is load-bearing twice over: the server validates it with
 * `z.string().datetime({ offset: true })`, and it must not come from `java.time`, which is
 * API 26+ while the SDK declares `minSdk 24` with no core-library desugaring. A `java.time` call
 * here crashed the host app on launch on API 24/25, because it runs from `initialize()`.
 *
 * A JVM test cannot catch the desugaring crash directly (the JVM always has `java.time`), so this
 * pins the format instead, and `SdkSourceConstraintsTest` guards the API surface.
 */
class TelemetryTimestampTest {

    /** Mirrors Zod's `datetime({ offset: true })` for the UTC-with-Z case the SDK emits. */
    private val isoUtc = Regex("""^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$""")

    @Test
    fun `timestamp is ISO-8601 UTC with a Z suffix`() {
        val ts = Telemetry.nowIso8601()
        assertTrue("not ISO-8601 UTC: $ts", isoUtc.matches(ts))
    }

    @Test
    fun `timestamp advances`() {
        val first = Telemetry.nowIso8601()
        Thread.sleep(5)
        val second = Telemetry.nowIso8601()
        assertTrue("timestamps went backwards: $first then $second", second >= first)
    }
}
