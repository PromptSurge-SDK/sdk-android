package com.promptsurge.sdk

import android.app.Application
import androidx.fragment.app.FragmentActivity
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.android.controller.ActivityController

/**
 * The host activity here carries the platform's default theme, not a Material one - which is the
 * common case in games, the SDK's target market. Building the dialog against a non-Material theme
 * used to throw out of `MaterialAlertDialogBuilder` and take the host app down with it.
 */
@RunWith(RobolectricTestRunner::class)
class PrePromptDialogFragmentTest {

    private val ctx: Application get() = ApplicationProvider.getApplicationContext()

    private fun launchActivity(): ActivityController<FragmentActivity> =
        Robolectric.buildActivity(FragmentActivity::class.java).setup()

    @After
    fun tearDown() {
        RateLimiter(ctx).reset()
        PrePromptDialogFragment.listener = null
        PromptSurge.reset()
    }

    @Test
    fun `shows on a non-Material host theme without throwing`() {
        val controller = launchActivity()
        val activity = controller.get()

        val fragment = PrePromptDialogFragment.newInstance()
        fragment.show(activity.supportFragmentManager, PrePromptDialogFragment.TAG)
        activity.supportFragmentManager.executePendingTransactions()

        assertNotNull("dialog was not created", fragment.dialog)
        assertTrue("dialog is not showing", fragment.dialog!!.isShowing)
    }

    @Test
    fun `records the cooldown when the dialog is shown, not when a button is tapped`() {
        // The dialog is setCancelable(false); a user who swipes the app away taps neither button.
        // Recording only on tap left that user eligible again immediately, forever.
        val limiter = RateLimiter(ctx)
        assertTrue("precondition: not rate-limited", limiter.canShow())

        val controller = launchActivity()
        val fragment = PrePromptDialogFragment.newInstance()
        fragment.show(controller.get().supportFragmentManager, PrePromptDialogFragment.TAG)
        controller.get().supportFragmentManager.executePendingTransactions()

        assertFalse("showing the dialog must start the cooldown", limiter.canShow())
    }
}
