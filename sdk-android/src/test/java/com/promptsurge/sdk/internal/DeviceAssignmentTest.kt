package com.promptsurge.sdk.internal

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

/**
 * Card 349 phase 4, the Android half: the server owns which holdout group a device is in, and
 * the SDK adopts that answer for the NEXT session rather than the current one.
 *
 * THE DEFECT. `deviceId` is SHA-256(ANDROID_ID + packageName) and survives a reinstall on
 * purpose. The holdout coin flip lives in SharedPreferences, which an uninstall wipes - so a
 * reinstalling device flips again and is counted in both groups under one id. Measured on prod
 * 2026-09-08: 2 of Night Hunt's 276 devices, and 2 of the 25 devices that appear in more than
 * one calendar month.
 *
 * WHY THE ADOPTION IS DEFERRED BY ONE SESSION, asserted below rather than only commented. The
 * server's answer arrives on a flush, which can land at any moment. Adopting it in place would
 * let one session show the pre-prompt before the flush and skip it after, and the events either
 * side would describe two different experiences under one session id. So `Telemetry.inHoldout`
 * is fixed at construction and only the prefs move.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class DeviceAssignmentTest {

    private fun makeEvent() = EventDto(
        eventType = EventTypes.PRE_PROMPT_SHOWN,
        eventId = UUID.randomUUID().toString(),
        timestamp = "2026-09-09T12:00:00Z",
        sessionId = UUID.randomUUID().toString(),
        deviceId = "device-x",
        appVersion = "1.0",
        sdkVersion = "0.0.1",
        locale = "en-US",
        platform = "android",
        payload = buildJsonObject {},
    )

    private class FakeHttp(private val results: ArrayDeque<HttpResponse>) : HttpClient {
        val calls = AtomicInteger(0)
        override suspend fun post(path: String, jsonBody: String): HttpResponse {
            calls.incrementAndGet()
            return results.removeFirst()
        }
    }

    private fun bus(http: HttpClient, dispatcher: kotlinx.coroutines.CoroutineDispatcher) =
        EventBus(
            httpClient = http,
            clock = { 0L },
            ioDispatcher = dispatcher,
            flushIntervalMs = 30_000L,
        )

    private fun accepted(body: String?) =
        HttpResponse(success = true, code = 202, body = body)

    // ── The bus reads the assignment off the response ────────────────────────

    @Test
    fun `a 202 carrying an assignment reaches the sink`() = runTest {
        val http = FakeHttp(ArrayDeque(listOf(accepted("""{"accepted":1,"skipped":0,"assignment":{"holdout":true}}"""))))
        val b = bus(http, StandardTestDispatcher(testScheduler))
        var seen: Boolean? = null
        b.onAssignment = { seen = it }
        b.enqueue(makeEvent())

        val result = b.flushNow()

        assertTrue(result is EventBus.FlushResult.Sent)
        assertEquals(true, seen)
    }

    @Test
    fun `a false assignment is delivered, not treated as absent`() = runTest {
        // The treatment group is the overwhelming majority, so `false` is the answer the sink
        // will almost always receive. A truthiness bug here would leave every reinstalled
        // treatment device on its local flip and close nothing.
        val http = FakeHttp(ArrayDeque(listOf(accepted("""{"assignment":{"holdout":false}}"""))))
        val b = bus(http, StandardTestDispatcher(testScheduler))
        var seen: Boolean? = null
        b.onAssignment = { seen = it }
        b.enqueue(makeEvent())

        b.flushNow()

        assertEquals(false, seen)
    }

    @Test
    fun `a 202 with no assignment leaves the sink untouched`() = runTest {
        // The server omits it for a batch carrying two devices, and for a write that failed.
        // Absent must mean "keep what you have", never "you are in the treatment group".
        val http = FakeHttp(ArrayDeque(listOf(accepted("""{"accepted":2,"skipped":0}"""))))
        val b = bus(http, StandardTestDispatcher(testScheduler))
        var calls = 0
        b.onAssignment = { calls += 1 }
        b.enqueue(makeEvent())

        b.flushNow()

        assertEquals(0, calls)
    }

    @Test
    fun `an unparseable body does not fail the flush`() = runTest {
        // The events were already accepted by the time this runs. A body that is truncated, or
        // shaped differently from what this SDK version expects, must never turn a successful
        // flush into a retried or dropped batch.
        val http = FakeHttp(ArrayDeque(listOf(accepted("<html>502 upstream</html>"))))
        val b = bus(http, StandardTestDispatcher(testScheduler))
        var calls = 0
        b.onAssignment = { calls += 1 }
        b.enqueue(makeEvent())

        val result = b.flushNow()

        assertTrue(result is EventBus.FlushResult.Sent)
        assertEquals(1, http.calls.get())
        assertEquals(0, calls)
    }

    @Test
    fun `a null or empty body does not fail the flush`() = runTest {
        val http = FakeHttp(ArrayDeque(listOf(accepted(null), accepted(""))))
        val b = bus(http, StandardTestDispatcher(testScheduler))
        b.onAssignment = { throw AssertionError("must not be called") }

        b.enqueue(makeEvent())
        assertTrue(b.flushNow() is EventBus.FlushResult.Sent)
        b.enqueue(makeEvent())
        assertTrue(b.flushNow() is EventBus.FlushResult.Sent)
    }

    @Test
    fun `an unknown field the server adds later does not break parsing`() = runTest {
        val http = FakeHttp(
            ArrayDeque(listOf(accepted("""{"assignment":{"holdout":true,"source":"ingest"},"newField":7}"""))),
        )
        val b = bus(http, StandardTestDispatcher(testScheduler))
        var seen: Boolean? = null
        b.onAssignment = { seen = it }
        b.enqueue(makeEvent())

        b.flushNow()

        assertEquals(true, seen)
    }

    @Test
    fun `a sink that throws does not fail the flush`() = runTest {
        val http = FakeHttp(ArrayDeque(listOf(accepted("""{"assignment":{"holdout":true}}"""))))
        val b = bus(http, StandardTestDispatcher(testScheduler))
        b.onAssignment = { throw IllegalStateException("disk full") }
        b.enqueue(makeEvent())

        assertTrue(b.flushNow() is EventBus.FlushResult.Sent)
    }

    @Test
    fun `a failed flush never reads an assignment`() = runTest {
        // Three attempts, all rejected, and the last one carries a body. A server that answered
        // 500 with a JSON error page must not be able to move a device's group.
        val http = FakeHttp(
            ArrayDeque(
                listOf(
                    HttpResponse(success = false, code = 500, body = """{"assignment":{"holdout":true}}"""),
                    HttpResponse(success = false, code = 500, body = """{"assignment":{"holdout":true}}"""),
                    HttpResponse(success = false, code = 500, body = """{"assignment":{"holdout":true}}"""),
                ),
            ),
        )
        val b = bus(http, StandardTestDispatcher(testScheduler))
        var calls = 0
        b.onAssignment = { calls += 1 }
        b.enqueue(makeEvent())

        val result = b.flushNow()

        assertTrue(result is EventBus.FlushResult.Dropped)
        assertEquals(0, calls)
    }

    // ── Telemetry persists it, and only for the next session ─────────────────

    private fun prefs() = ApplicationProvider.getApplicationContext<Application>()
        .getSharedPreferences("ps_telemetry", android.content.Context.MODE_PRIVATE)

    /**
     * Every bus handed to [Telemetry.create] below, so [telemetryTest] can stop it again.
     *
     * `Telemetry.create` calls `EventBus.start`, which launches a `while (isActive) { delay(...) }`
     * periodic flush on the dispatcher it was given. When that dispatcher shares `runTest`'s
     * scheduler, the loop never runs out of work in virtual time, so `runTest` advances the clock
     * forever after the body returns and the test JVM hangs with no failure and no output. That
     * is what happened to CI run 34366242349 (`Run Android unit tests`, over two hours, cancelled)
     * and to a local `:sdk-android:test` before it. No other test in this module calls
     * `Telemetry.create`, which is why nothing caught it earlier.
     */
    private val startedBuses = mutableListOf<EventBus>()

    private fun telemetryWith(http: HttpClient, dispatcher: kotlinx.coroutines.CoroutineDispatcher): Telemetry {
        val b = bus(http, dispatcher)
        startedBuses += b
        return Telemetry.create(
            ApplicationProvider.getApplicationContext(),
            apiKey = "ps_test",
            busOverride = b,
        )
    }

    /**
     * `runTest` for the tests that build a [Telemetry]: stops the periodic flush loop before the
     * body returns, in a `finally` so a failing assertion reports its failure instead of hanging.
     * An `@After` would be too late - `runTest` drains the scheduler inside the test method.
     */
    private fun telemetryTest(body: suspend TestScope.() -> Unit) = runTest {
        try {
            body()
        } finally {
            startedBuses.forEach { it.stop() }
            startedBuses.clear()
        }
    }

    @Test
    fun `the server's answer is written to prefs`() = telemetryTest {
        prefs().edit().clear().commit()
        // Force the local flip to the treatment group so the server's `true` is a real change.
        prefs().edit().putBoolean("holdout_assigned", true).putBoolean("in_holdout", false).commit()

        val http = FakeHttp(ArrayDeque(listOf(accepted("""{"assignment":{"holdout":true}}"""))))
        val tel = telemetryWith(http, StandardTestDispatcher(testScheduler))
        tel.fire(EventTypes.INITIALIZE)
        tel.bus().flushNow()

        assertTrue(prefs().getBoolean("in_holdout", false))
        assertTrue(prefs().getBoolean("holdout_from_server", false))
    }

    @Test
    fun `the current session keeps the group it started in`() = telemetryTest {
        // The whole reason the adoption is deferred. `isInHoldout()` decides whether the
        // pre-prompt is shown; flipping it mid-session would split one session across two
        // experiences.
        prefs().edit().clear().commit()
        prefs().edit().putBoolean("holdout_assigned", true).putBoolean("in_holdout", false).commit()

        val http = FakeHttp(ArrayDeque(listOf(accepted("""{"assignment":{"holdout":true}}"""))))
        val tel = telemetryWith(http, StandardTestDispatcher(testScheduler))
        assertFalse(tel.isInHoldout())

        tel.fire(EventTypes.INITIALIZE)
        tel.bus().flushNow()

        assertFalse("the running session must not change group", tel.isInHoldout())
    }

    @Test
    fun `the next session picks the server's group up`() = telemetryTest {
        prefs().edit().clear().commit()
        prefs().edit().putBoolean("holdout_assigned", true).putBoolean("in_holdout", false).commit()

        val first = FakeHttp(ArrayDeque(listOf(accepted("""{"assignment":{"holdout":true}}"""))))
        val tel = telemetryWith(first, StandardTestDispatcher(testScheduler))
        tel.fire(EventTypes.INITIALIZE)
        tel.bus().flushNow()

        val second = telemetryWith(FakeHttp(ArrayDeque()), StandardTestDispatcher(testScheduler))
        assertTrue("the next session must honour the server", second.isInHoldout())
    }

    @Test
    fun `a reinstalled device is put back in its first group`() = telemetryTest {
        // The defect itself, end to end on this side of the wire. An uninstall clears the
        // prefs; the fresh install flips locally and lands in the treatment group; the server
        // still remembers the holdout assignment against the surviving deviceId. The session
        // after the first flush is back where it belongs, and one device is no longer two.
        prefs().edit().clear().commit()

        val http = FakeHttp(ArrayDeque(listOf(accepted("""{"assignment":{"holdout":true}}"""))))
        val fresh = telemetryWith(http, StandardTestDispatcher(testScheduler))
        fresh.fire(EventTypes.FIRST_OPEN)
        fresh.bus().flushNow()

        val afterRestart = telemetryWith(FakeHttp(ArrayDeque()), StandardTestDispatcher(testScheduler))
        assertTrue(afterRestart.isInHoldout())
    }

    @Test
    fun `an unseen device keeps its local flip and no server marker`() = telemetryTest {
        // A first session on a device the server has never seen still has to work, and it must
        // not leave a marker claiming the server spoke.
        prefs().edit().clear().commit()
        prefs().edit().putBoolean("holdout_assigned", true).putBoolean("in_holdout", true).commit()

        val http = FakeHttp(ArrayDeque(listOf(accepted("""{"accepted":1,"skipped":0}"""))))
        val tel = telemetryWith(http, StandardTestDispatcher(testScheduler))
        tel.fire(EventTypes.INITIALIZE)
        tel.bus().flushNow()

        assertTrue(prefs().getBoolean("in_holdout", false))
        assertFalse(prefs().getBoolean("holdout_from_server", false))
    }

    @Test
    fun `events already queued still carry the group they were served under`() = telemetryTest {
        // `Event.holdout` records what the user actually experienced. The server does not
        // rewrite it and neither does the SDK; a batch sent after an assignment lands still
        // describes the session it came from.
        prefs().edit().clear().commit()
        prefs().edit().putBoolean("holdout_assigned", true).putBoolean("in_holdout", false).commit()

        val http = object : HttpClient {
            val bodies = mutableListOf<String>()
            override suspend fun post(path: String, jsonBody: String): HttpResponse {
                bodies += jsonBody
                return accepted("""{"assignment":{"holdout":true}}""")
            }
        }
        val tel = telemetryWith(http, StandardTestDispatcher(testScheduler))
        tel.fire(EventTypes.INITIALIZE)
        tel.bus().flushNow()
        tel.fire(EventTypes.PRE_PROMPT_SHOWN)
        tel.bus().flushNow()

        assertEquals(2, http.bodies.size)
        assertTrue("""the second batch must still say holdout=false""", http.bodies[1].contains("\"holdout\":false"))
    }

    // ── The response model itself ────────────────────────────────────────────

    @Test
    fun `the response model tolerates a body with only an assignment`() {
        val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
        val parsed = json.decodeFromString(
            EventBatchResponseDto.serializer(),
            """{"assignment":{"holdout":true}}""",
        )
        assertEquals(0, parsed.accepted)
        assertEquals(true, parsed.assignment?.holdout)
    }

    @Test
    fun `the response model leaves assignment null when the server omits it`() {
        val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
        val parsed = json.decodeFromString(
            EventBatchResponseDto.serializer(),
            """{"accepted":3,"skipped":1}""",
        )
        assertEquals(3, parsed.accepted)
        assertEquals(1, parsed.skipped)
        assertNull(parsed.assignment)
    }
}
