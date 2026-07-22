package com.promptsurge.sdk.internal

import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/**
 * Status-code branching for the prompt fetch. Each branch drives a different suppression, so
 * getting one wrong either silently disables a paying customer's SDK or shows bundled English
 * copy where the developer's own copy should be.
 */
class OkHttpGetClientTest {

    private lateinit var server: MockWebServer
    private lateinit var client: OkHttpGetClient

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        client = OkHttpGetClient(OkHttpClient(), server.url("/").toString(), "ps_live_test")
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun enqueue(code: Int, body: String) {
        server.enqueue(MockResponse().setResponseCode(code).setBody(body))
    }

    @Test
    fun `200 returns the body`() = runBlocking {
        enqueue(200, """{"locale":"en"}""")
        assertEquals("""{"locale":"en"}""", client.get("/v1/prompts"))
    }

    @Test
    fun `401 is unauthorized`() = runBlocking {
        enqueue(401, """{"error":"invalid_api_key"}""")
        try {
            client.get("/v1/prompts")
            fail("expected UnauthorizedException")
        } catch (e: UnauthorizedException) {
            assertTrue(e.message!!.contains("401"))
        }
    }

    @Test
    fun `403 is unauthorized`() = runBlocking {
        enqueue(403, """{"error":"forbidden"}""")
        try {
            client.get("/v1/prompts")
            fail("expected UnauthorizedException")
        } catch (_: UnauthorizedException) {
            // expected
        }
    }

    @Test
    fun `402 is an impression limit`() = runBlocking {
        enqueue(402, """{"error":"impression_limit_exceeded"}""")
        try {
            client.get("/v1/prompts")
            fail("expected ImpressionLimitExceededException")
        } catch (_: ImpressionLimitExceededException) {
            // expected
        }
    }

    @Test
    fun `404 with error app_deleted is app deleted`() = runBlocking {
        enqueue(404, """{"error":"app_deleted"}""")
        try {
            client.get("/v1/prompts")
            fail("expected AppDeletedException")
        } catch (_: AppDeletedException) {
            // expected
        }
    }

    @Test
    fun `404 that merely mentions app_deleted is not app deleted`() = runBlocking {
        // The old code substring-matched the whole body, so a routing 404 from a proxy - or any
        // error text quoting the term - permanently disabled the SDK on that install.
        enqueue(404, """{"error":"not_found","detail":"no route; see app_deleted docs"}""")
        try {
            client.get("/v1/prompts")
            fail("expected a generic failure")
        } catch (e: AppDeletedException) {
            fail("a routing 404 must not be read as app_deleted")
        } catch (_: IllegalStateException) {
            // expected: generic "HTTP 404", retried on the next fetch
        }
    }

    @Test
    fun `404 with an unparseable body is not app deleted`() = runBlocking {
        enqueue(404, "<html>app_deleted</html>")
        try {
            client.get("/v1/prompts")
            fail("expected a generic failure")
        } catch (e: AppDeletedException) {
            fail("an HTML error page must not be read as app_deleted")
        } catch (_: IllegalStateException) {
            // expected
        }
    }
}
