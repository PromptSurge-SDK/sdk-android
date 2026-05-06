package com.promptsurge.sdk

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RateLimiterTest {

    private lateinit var rateLimiter: RateLimiter

    @Before
    fun setUp() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        rateLimiter = RateLimiter(ctx)
        rateLimiter.reset()
    }

    @Test
    fun `canShow is true when no history exists`() {
        assertTrue(rateLimiter.canShow())
    }

    @Test
    fun `canShow is false immediately after recordShown`() {
        rateLimiter.recordShown()
        assertFalse(rateLimiter.canShow())
    }

    @Test
    fun `canShow is false immediately after recordDismissed`() {
        rateLimiter.recordDismissed()
        assertFalse(rateLimiter.canShow())
    }

    @Test
    fun `canShow is true again after reset`() {
        rateLimiter.recordShown()
        rateLimiter.reset()
        assertTrue(rateLimiter.canShow())
    }

    @Test
    fun `shown cooldown is 90 days`() {
        // Simulate the stored timestamp being just inside the 90-day window
        val justInsideWindow = System.currentTimeMillis() - RateLimiter.SHOWN_COOLDOWN_MS + 1_000
        val prefs = ApplicationProvider.getApplicationContext<Application>()
            .getSharedPreferences("ps_rate_limiter", android.content.Context.MODE_PRIVATE)
        prefs.edit().putLong("last_shown_at", justInsideWindow).apply()

        assertFalse("Should be blocked when inside 90-day shown window", rateLimiter.canShow())
    }

    @Test
    fun `shown cooldown expires after 90 days`() {
        val justOutsideWindow = System.currentTimeMillis() - RateLimiter.SHOWN_COOLDOWN_MS - 1_000
        val prefs = ApplicationProvider.getApplicationContext<Application>()
            .getSharedPreferences("ps_rate_limiter", android.content.Context.MODE_PRIVATE)
        prefs.edit().putLong("last_shown_at", justOutsideWindow).apply()

        assertTrue("Should be allowed when past 90-day shown window", rateLimiter.canShow())
    }

    @Test
    fun `dismissed cooldown is 7 days`() {
        val justInsideWindow = System.currentTimeMillis() - RateLimiter.DISMISSED_COOLDOWN_MS + 1_000
        val prefs = ApplicationProvider.getApplicationContext<Application>()
            .getSharedPreferences("ps_rate_limiter", android.content.Context.MODE_PRIVATE)
        prefs.edit().putLong("last_dismissed_at", justInsideWindow).apply()

        assertFalse("Should be blocked when inside 7-day dismissed window", rateLimiter.canShow())
    }

    @Test
    fun `dismissed cooldown expires after 7 days`() {
        val justOutsideWindow = System.currentTimeMillis() - RateLimiter.DISMISSED_COOLDOWN_MS - 1_000
        val prefs = ApplicationProvider.getApplicationContext<Application>()
            .getSharedPreferences("ps_rate_limiter", android.content.Context.MODE_PRIVATE)
        prefs.edit().putLong("last_dismissed_at", justOutsideWindow).apply()

        assertTrue("Should be allowed when past 7-day dismissed window", rateLimiter.canShow())
    }

    @Test
    fun `second call within window is a no-op (rate-limited)`() {
        rateLimiter.recordShown()
        // Simulates what PromptSurge does on the second requestReview call
        assertFalse("Second requestReview within 90-day window must be blocked", rateLimiter.canShow())
    }

    @Test
    fun `dismiss cooldown does not block past 7 days even when shown cooldown is longer`() {
        // After a dismiss + 8 days, show cooldown hasn't started so canShow must be true
        val eightDaysAgo = System.currentTimeMillis() - (8L * 24 * 60 * 60 * 1000)
        val prefs = ApplicationProvider.getApplicationContext<Application>()
            .getSharedPreferences("ps_rate_limiter", android.content.Context.MODE_PRIVATE)
        prefs.edit().putLong("last_dismissed_at", eightDaysAgo).apply()

        assertTrue("Should be allowed after 8 days following a dismiss", rateLimiter.canShow())
    }
}
