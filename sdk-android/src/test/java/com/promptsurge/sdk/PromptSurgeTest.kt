package com.promptsurge.sdk

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
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
        PromptSurge.initialize(ctx, "ps_live_key_1")
    }

    @Test
    fun `initialize with a blank key leaves the SDK uninitialized`() {
        // Bundled English copy shown under a broken key is the failure mode this prevents: it
        // looks like a working install to the integrator, and every one of their users gets copy
        // the developer never wrote.
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        PromptSurge.initialize(ctx, "   ")
        assertNull("a blank key must not initialize telemetry", PromptSurge.telemetry)

        // ...and the slot is still free, so the real key initializes normally afterwards.
        PromptSurge.initialize(ctx, "ps_live_key_1")
        assertNotNull(PromptSurge.telemetry)
    }

    @Test
    fun `initialize trims surrounding whitespace rather than treating it as a different key`() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        PromptSurge.initialize(ctx, "ps_live_key_1")
        PromptSurge.initialize(ctx, "  ps_live_key_1\n") // must not throw
    }

    @Test
    fun `requestReview is a no-op once the activity is finishing`() {
        // The documented call site is an async level-complete callback, which is exactly when the
        // activity may be going away. Showing a DialogFragment then throws.
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        PromptSurge.initialize(ctx, "ps_live_key_1")
        val controller = org.robolectric.Robolectric
            .buildActivity(androidx.fragment.app.FragmentActivity::class.java)
            .setup()
        controller.get().finish()

        PromptSurge.requestReview(controller.get()) // must not throw

        assertNull(
            controller.get().supportFragmentManager
                .findFragmentByTag(PrePromptDialogFragment.TAG),
        )
    }

    @Test
    fun `requestReview does not stack a second dialog`() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        seedDeterministicState(ctx)
        PromptSurge.initialize(ctx, "ps_live_key_1")
        // Swap the live repository for an offline one: initialize() fires a real prefetch, and a
        // 401 from the real API against this fake key would suppress the dialog for the wrong
        // reason. Bundled defaults are all this test needs.
        PromptSurge.promptRepo = offlineRepo(ctx)

        val activity = org.robolectric.Robolectric
            .buildActivity(androidx.fragment.app.FragmentActivity::class.java)
            .setup().get()

        PromptSurge.requestReview(activity)
        activity.supportFragmentManager.executePendingTransactions()
        assertEquals(
            "first requestReview should show the pre-prompt",
            1,
            activity.supportFragmentManager.fragments.count { it is PrePromptDialogFragment },
        )

        PromptSurge.requestReview(activity)
        activity.supportFragmentManager.executePendingTransactions()
        assertEquals(
            "a second call must not stack a second dialog",
            1,
            activity.supportFragmentManager.fragments.count { it is PrePromptDialogFragment },
        )
    }

    /**
     * Holdout assignment is a 10% coin flip persisted on first use; left to chance it makes any
     * dialog assertion flaky one run in ten. Pinning it to "not in holdout" is the only way a
     * test of the dialog path means anything.
     */
    private fun seedDeterministicState(ctx: Application) {
        ctx.getSharedPreferences("ps_telemetry", 0).edit()
            .putBoolean("holdout_assigned", true)
            .putBoolean("in_holdout", false)
            .apply()
    }

    private fun offlineRepo(ctx: Application) = com.promptsurge.sdk.internal.PromptTextRepository(
        appContext = ctx,
        httpClient = object : com.promptsurge.sdk.internal.PromptTextRepository.HttpClient {
            override suspend fun get(path: String): String = error("offline")
        },
        clock = System::currentTimeMillis,
        ioDispatcher = kotlinx.coroutines.Dispatchers.Unconfined,
    )

    @Test
    fun `initialize with same key is idempotent`() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        PromptSurge.initialize(ctx, "ps_live_same_key")
        PromptSurge.initialize(ctx, "ps_live_same_key") // must not throw
    }

    @Test
    fun `initialize with different key throws IllegalStateException`() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        PromptSurge.initialize(ctx, "ps_live_key_1")
        assertThrows(IllegalStateException::class.java) {
            PromptSurge.initialize(ctx, "ps_live_key_2")
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
