package com.promptsurge.sdk.internal

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class EventBusTest {

    private fun makeEvent(type: String = EventTypes.PRE_PROMPT_SHOWN) = EventDto(
        eventType = type,
        eventId = UUID.randomUUID().toString(),
        timestamp = "2026-05-05T12:00:00Z",
        sessionId = UUID.randomUUID().toString(),
        deviceId = "device-x",
        appVersion = "1.0",
        sdkVersion = "0.0.1",
        locale = "en-US",
        platform = "android",
        payload = buildJsonObject {},
    )

    private class FakeHttp(
        private val results: ArrayDeque<HttpResponse>,
    ) : HttpClient {
        val calls = AtomicInteger(0)
        var lastBody: String? = null
        override suspend fun post(path: String, jsonBody: String): HttpResponse {
            calls.incrementAndGet()
            lastBody = jsonBody
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

    @Test
    fun `queue drops oldest when capacity exceeded`() {
        val http = FakeHttp(ArrayDeque())
        val b = bus(http, StandardTestDispatcher())
        repeat(EventBus.MAX_QUEUE + 25) { b.enqueue(makeEvent()) }
        assertEquals(EventBus.MAX_QUEUE, b.queueSize())
    }

    @Test
    fun `flushNow on empty queue returns Empty without HTTP call`() = runTest {
        val http = FakeHttp(ArrayDeque())
        val b = bus(http, StandardTestDispatcher(testScheduler))
        val result = b.flushNow()
        assertTrue(result is EventBus.FlushResult.Empty)
        assertEquals(0, http.calls.get())
    }

    @Test
    fun `flushNow happy path sends batch and clears queue`() = runTest {
        val http = FakeHttp(ArrayDeque(listOf(HttpResponse(success = true, code = 202))))
        val b = bus(http, StandardTestDispatcher(testScheduler))
        b.enqueue(makeEvent())
        b.enqueue(makeEvent(EventTypes.PRE_PROMPT_CONFIRMED))

        val result = b.flushNow()
        advanceUntilIdle()

        assertTrue("expected Sent, got $result", result is EventBus.FlushResult.Sent)
        assertEquals(2, (result as EventBus.FlushResult.Sent).count)
        assertEquals(1, result.attempts)
        assertEquals(0, b.queueSize())
        assertEquals(1, http.calls.get())
        assertTrue(http.lastBody!!.contains("\"events\""))
    }

    @Test
    fun `flushNow retries with backoff and succeeds on third attempt`() = runTest {
        val http = FakeHttp(
            ArrayDeque(
                listOf(
                    HttpResponse(success = false, code = 500, errorMessage = "boom"),
                    HttpResponse(success = false, code = 502, errorMessage = "boom"),
                    HttpResponse(success = true, code = 202),
                ),
            ),
        )
        val b = bus(http, StandardTestDispatcher(testScheduler))
        b.enqueue(makeEvent())

        val result = b.flushNow()
        advanceUntilIdle()

        assertTrue("expected Sent, got $result", result is EventBus.FlushResult.Sent)
        assertEquals(3, (result as EventBus.FlushResult.Sent).attempts)
        assertEquals(3, http.calls.get())
    }

    @Test
    fun `flushNow drops batch after 3 failed attempts`() = runTest {
        val http = FakeHttp(
            ArrayDeque(
                listOf(
                    HttpResponse(success = false, code = 500, errorMessage = "boom"),
                    HttpResponse(success = false, code = 500, errorMessage = "boom"),
                    HttpResponse(success = false, code = 500, errorMessage = "boom"),
                ),
            ),
        )
        val b = bus(http, StandardTestDispatcher(testScheduler))
        b.enqueue(makeEvent())
        b.enqueue(makeEvent())

        val result = b.flushNow()
        advanceUntilIdle()

        assertTrue("expected Dropped, got $result", result is EventBus.FlushResult.Dropped)
        assertEquals(2, (result as EventBus.FlushResult.Dropped).count)
        assertEquals(3, http.calls.get())
        assertEquals(0, b.queueSize())
    }

    @Test
    fun `device id is stable across calls and is hex sha-256 length`() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        DeviceId.resetForTesting()
        val a = DeviceId.get(ctx)
        val b = DeviceId.get(ctx)
        assertEquals(a, b)
        assertEquals(64, a.length) // 32 bytes hex
        assertTrue(a.matches(Regex("^[0-9a-f]{64}$")))
    }
}
