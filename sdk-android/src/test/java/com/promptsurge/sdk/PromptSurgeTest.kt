package com.promptsurge.sdk

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PromptSurgeTest {

    @After
    fun tearDown() {
        PromptSurge.reset()
    }

    @Test
    fun `initialize succeeds on first call`() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        PromptSurge.initialize(ctx, "key-1")
    }

    @Test
    fun `initialize with same key is idempotent`() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        PromptSurge.initialize(ctx, "same-key")
        PromptSurge.initialize(ctx, "same-key") // must not throw
    }

    @Test
    fun `initialize with different key throws IllegalStateException`() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        PromptSurge.initialize(ctx, "key-1")
        assertThrows(IllegalStateException::class.java) {
            PromptSurge.initialize(ctx, "key-2")
        }
    }

    @Test
    fun `requestReview before initialize is a no-op and does not throw`() {
        // Should log an error but not crash
        // We can't easily verify no dialog was shown without a Robolectric shadow,
        // but we verify no exception is thrown.
        // (A real activity is required to show a dialog; we just ensure the guard works.)
        PromptSurge.requestReview(
            org.robolectric.Robolectric.buildActivity(
                androidx.fragment.app.FragmentActivity::class.java
            ).create().get()
        )
    }
}
