package com.promptsurge.sdk

import android.app.Application
import android.content.Context
import android.os.Looper
import androidx.fragment.app.FragmentActivity
import androidx.test.core.app.ApplicationProvider
import com.google.android.play.core.review.testing.FakeReviewManager
import com.promptsurge.sdk.internal.PromptTextRepository
import kotlinx.coroutines.Dispatchers
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf

/**
 * Card 615: Google does not publish its review quota, and its guide says asking again within a
 * short period (for example, less than a month) may show nothing. Both stores warn against a
 * button that leads to the review API for that reason: the tap can be answered by nothing. So
 * the SDK records every native request it makes and, inside 30 days of one, shows no pre-prompt
 * and makes no native call.
 *
 * The warm-up and holdout paths ask Play directly and are held to the same rule, so both arms of
 * the experiment skip under the same condition.
 */
@RunWith(RobolectricTestRunner::class)
class NativeReviewQuotaTest {

    private val ctx: Application get() = ApplicationProvider.getApplicationContext()
    private var now = 1_800_000_000_000L

    private fun limiter() = RateLimiter(ctx) { now }

    @After
    fun tearDown() {
        PromptSurge.reset()
    }

    // ── The rule ─────────────────────────────────────────────────────────────────────────

    @Test
    fun `the rule is one request in 30 days`() {
        assertEquals(1, RateLimiter.NATIVE_REQUEST_LIMIT)
        assertEquals(30L * DAY, RateLimiter.NATIVE_REQUEST_WINDOW_MS)
    }

    @Test
    fun `with nothing recorded the quota is open`() {
        assertNull(limiter().quotaBlockedUntil())
    }

    @Test
    fun `one request closes the quota for 30 days`() {
        val rl = limiter()
        rl.recordNativeRequest()

        assertEquals(now + 30 * DAY, rl.quotaBlockedUntil())
    }

    @Test
    fun `a request 30 days old no longer counts`() {
        val rl = limiter()
        val first = now
        rl.recordNativeRequest()

        now = first + 30 * DAY - 1
        assertNotNull("one millisecond short of 30 days is still inside the window", rl.quotaBlockedUntil())

        now = first + 30 * DAY
        assertNull(rl.quotaBlockedUntil())
    }

    @Test
    fun `the pure rule picks the request that has to age out`() {
        // The same function serves a limit above one; with four recent requests and a limit of
        // three, the count drops below the limit when the SECOND oldest ages out.
        val window = 365 * DAY
        val requests = listOf(now - 300 * DAY, now - 1 * DAY, now - 200 * DAY, now - 100 * DAY)

        assertEquals(now - 200 * DAY + window, RateLimiter.nextPossibleRequest(requests, now, 3, window))
        assertNull(RateLimiter.nextPossibleRequest(requests.take(1), now, 3, window))
    }

    @Test
    fun `only the last few requests are kept`() {
        val rl = limiter()
        repeat(8) {
            rl.recordNativeRequest()
            now += DAY
        }

        val stored = rl.nativeRequests()
        assertEquals(RateLimiter.MAX_STORED_REQUESTS, stored.size)
        assertEquals("the newest entry survives the cap", now - DAY, stored.last())
    }

    @Test
    fun `a corrupted entry is skipped rather than throwing`() {
        prefs().edit().putString(RateLimiter.KEY_NATIVE_REQUESTS, "garbage,$now").apply()

        assertEquals(listOf(now), limiter().nativeRequests())
    }

    @Test
    fun `recording a request does not start the cooldown`() {
        // The two are separate gates: the native paths record the 90-day cooldown themselves.
        val rl = limiter()
        rl.recordNativeRequest()

        assertTrue(rl.canShow())
    }

    @Test
    fun `reset clears the quota record with the cooldowns`() {
        val rl = limiter()
        rl.recordNativeRequest()
        rl.reset()

        assertNull(rl.quotaBlockedUntil())
    }

    // ── The paths that reach Play ────────────────────────────────────────────────────────

    @Test
    fun `a holdout device records its native request`() {
        val activity = startSdk(holdout = true)

        PromptSurge.requestReview(activity)
        shadowOf(Looper.getMainLooper()).idle()

        assertEquals("a holdout device asks Play directly, and that is on the record", 1, RateLimiter(ctx).nativeRequests().size)
        assertNull("and it never sees the dialog", dialogIn(activity))
        assertFalse("the review flow completed and recorded the 90-day cooldown", RateLimiter(ctx).canShow())
    }

    @Test
    fun `a holdout device inside the quota window makes no native call`() {
        // The control arm skips under the same rule as the treatment arm, so the native-only arm
        // is never credited with a request Play would probably not have shown.
        seedNativeRequest(System.currentTimeMillis() - DAY)
        val activity = startSdk(holdout = true)

        PromptSurge.requestReview(activity)
        shadowOf(Looper.getMainLooper()).idle()

        assertEquals("a skipped call is not a request", 1, RateLimiter(ctx).nativeRequests().size)
        assertTrue("and it leaves no cooldown behind", RateLimiter(ctx).canShow())
    }

    @Test
    fun `a warm-up device records its native request`() {
        ctx.getSharedPreferences("ps_prompt_text", Context.MODE_PRIVATE).edit()
            .putBoolean("warmup_active", true).apply()
        val activity = startSdk(holdout = false)

        PromptSurge.requestReview(activity)
        shadowOf(Looper.getMainLooper()).idle()

        assertEquals(1, RateLimiter(ctx).nativeRequests().size)
        assertNull("warm-up never shows the dialog", dialogIn(activity))
    }

    @Test
    fun `a treatment device inside the quota window is not shown a pre-prompt`() {
        seedNativeRequest(System.currentTimeMillis() - DAY)
        val activity = startSdk(holdout = false)

        PromptSurge.requestReview(activity)
        activity.supportFragmentManager.executePendingTransactions()

        assertNull("a Sure here could be answered by nothing", dialogIn(activity))
    }

    @Test
    fun `a treatment device past the quota window is shown the pre-prompt`() {
        seedNativeRequest(System.currentTimeMillis() - 31 * DAY)
        val activity = startSdk(holdout = false)

        PromptSurge.requestReview(activity)
        activity.supportFragmentManager.executePendingTransactions()

        assertNotNull(dialogIn(activity))
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────────────

    private fun prefs() = ctx.getSharedPreferences("ps_rate_limiter", Context.MODE_PRIVATE)

    private fun seedNativeRequest(at: Long) {
        prefs().edit().putString(RateLimiter.KEY_NATIVE_REQUESTS, at.toString()).apply()
    }

    /**
     * Initializes the SDK with the holdout group pinned, an offline prompt repository (bundled
     * copy, no 401 from the real API against a fake key) and Play's own FakeReviewManager.
     */
    private fun startSdk(holdout: Boolean): FragmentActivity {
        ctx.getSharedPreferences("ps_telemetry", 0).edit()
            .putBoolean("holdout_assigned", true)
            .putBoolean("in_holdout", holdout)
            .apply()
        PromptSurge.initialize(ctx, "ps_live_key_1")
        PromptSurge.promptRepo = PromptTextRepository(
            appContext = ctx,
            httpClient = object : PromptTextRepository.HttpClient {
                override suspend fun get(path: String): String = error("offline")
            },
            clock = System::currentTimeMillis,
            ioDispatcher = Dispatchers.Unconfined,
        )
        PromptSurge.reviewManagerFactory = { FakeReviewManager(it) }
        return Robolectric.buildActivity(FragmentActivity::class.java).setup().get()
    }

    private fun dialogIn(activity: FragmentActivity) =
        activity.supportFragmentManager.findFragmentByTag(PrePromptDialogFragment.TAG)

    private companion object {
        const val DAY = 24L * 60 * 60 * 1000
    }
}
