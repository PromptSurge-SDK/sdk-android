package com.promptsurge.sdk.internal

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class PromptTextRepositoryTest {

    private val ctx: Application get() = ApplicationProvider.getApplicationContext()
    private var fakeNow: Long = 1_000L

    private class FakeHttp : PromptTextRepository.HttpClient {
        var nextResponse: String? = null
        var failWith: Throwable? = null
        var calls = 0
        var lastPath: String? = null
        override suspend fun get(path: String): String {
            calls += 1
            lastPath = path
            failWith?.let { throw it }
            return nextResponse ?: error("no response queued")
        }
    }

    private fun newRepo(http: FakeHttp = FakeHttp()): PromptTextRepository =
        PromptTextRepository(
            appContext = ctx,
            httpClient = http,
            clock = { fakeNow },
            ioDispatcher = UnconfinedTestDispatcher(),
            ttlMs = 24L * 60 * 60 * 1000,
        ).also { it.resetForTesting() }

    private val sample = """{"locale":"de","title":"Hallo","body":"B","ctaConfirm":"Ja","ctaDismiss":"Nein"}"""

    @After
    fun tearDown() {
        ctx.getSharedPreferences("ps_prompt_text", 0).edit().clear().apply()
    }

    @Test
    fun `fetches and caches when no cache present`() = runTest {
        val http = FakeHttp().apply { nextResponse = sample }
        val repo = newRepo(http)

        val first = repo.getCurrentText()
        assertEquals("Hallo", first.title)
        assertEquals(1, http.calls)

        // Second call uses memory cache — no second HTTP.
        val second = repo.getCurrentText()
        assertEquals("Hallo", second.title)
        assertEquals(1, http.calls)
    }

    @Test
    fun `disk cache survives new repo instance within TTL`() = runTest {
        val http1 = FakeHttp().apply { nextResponse = sample }
        val r1 = newRepo(http1)
        r1.getCurrentText()

        // New repo instance, network would fail — must serve disk cache.
        val http2 = FakeHttp().apply { failWith = RuntimeException("offline") }
        val r2 = PromptTextRepository(
            appContext = ctx,
            httpClient = http2,
            clock = { fakeNow + 5_000L },
            ioDispatcher = UnconfinedTestDispatcher(),
            ttlMs = 24L * 60 * 60 * 1000,
        )
        val out = r2.getCurrentText()
        assertEquals("Hallo", out.title)
        assertEquals(0, http2.calls) // fresh disk cache short-circuits the fetch
    }

    @Test
    fun `expired cache triggers refetch`() = runTest {
        val http = FakeHttp().apply { nextResponse = sample }
        val repo = newRepo(http)
        repo.getCurrentText()
        assertEquals(1, http.calls)

        // Advance past TTL; queue a new response.
        fakeNow += 25L * 60 * 60 * 1000
        http.nextResponse =
            """{"locale":"de","title":"Updated","body":"B","ctaConfirm":"Ja","ctaDismiss":"Nein"}"""
        val updated = repo.getCurrentText()
        assertEquals("Updated", updated.title)
        assertEquals(2, http.calls)
    }

    @Test
    fun `network failure with stale cache returns stale value`() = runTest {
        // Prime the cache via a successful first fetch.
        val httpOk = FakeHttp().apply { nextResponse = sample }
        val repo = newRepo(httpOk)
        repo.getCurrentText()

        // Move past TTL and swap the http client for a failing one.
        fakeNow += 25L * 60 * 60 * 1000
        val httpFail = FakeHttp().apply { failWith = RuntimeException("boom") }
        val repo2 = PromptTextRepository(
            appContext = ctx,
            httpClient = httpFail,
            clock = { fakeNow },
            ioDispatcher = UnconfinedTestDispatcher(),
            ttlMs = 24L * 60 * 60 * 1000,
        )
        val out = repo2.getCurrentText()
        assertEquals("Hallo", out.title) // stale cache served
        assertEquals(1, httpFail.calls)
    }

    @Test
    fun `network failure with no cache returns bundled defaults`() = runTest {
        val http = FakeHttp().apply { failWith = RuntimeException("boom") }
        val repo = newRepo(http)
        val out = repo.getCurrentText()
        assertEquals(PromptDefaults.TITLE, out.title)
        assertEquals(PromptDefaults.LOCALE, out.locale)
    }

    @Test
    fun `getCachedOrDefaults returns defaults when nothing cached`() {
        val repo = newRepo()
        val out = repo.getCachedOrDefaults()
        assertEquals(PromptDefaults.TITLE, out.title)
    }

    @Test
    fun `setLocaleOverride changes activeLocale and triggers refetch on next call`() = runTest {
        val http = FakeHttp().apply { nextResponse = sample }
        val repo = newRepo(http)
        repo.setLocaleOverride("ja")
        assertEquals("ja", repo.activeLocale())
        repo.getCurrentText()
        assert(http.lastPath?.contains("locale=ja") == true) {
            "expected request path to include locale=ja, got ${http.lastPath}"
        }
    }
}
