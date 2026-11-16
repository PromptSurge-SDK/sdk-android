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

    // ── Card 833: "announce only" ─────────────────────────────────────────────────────────

    private class Recorder(override val notice: Boolean) : PrePromptDialogFragment.DialogListener {
        var confirmed = 0
        var dismissed = 0
        override fun onConfirmed(activity: FragmentActivity) { confirmed += 1 }
        override fun onDismissed() { dismissed += 1 }
    }

    private fun show(listener: Recorder): Pair<PrePromptDialogFragment, androidx.appcompat.app.AlertDialog> {
        PrePromptDialogFragment.listener = listener
        val controller = launchActivity()
        val fragment = PrePromptDialogFragment.newInstance()
        fragment.show(controller.get().supportFragmentManager, PrePromptDialogFragment.TAG)
        controller.get().supportFragmentManager.executePendingTransactions()
        return fragment to (fragment.dialog as androidx.appcompat.app.AlertDialog)
    }

    @Test
    fun `notice mode draws one button and no Not now`() {
        val (_, dialog) = show(Recorder(notice = true))
        val positive = dialog.getButton(android.content.DialogInterface.BUTTON_POSITIVE)
        val negative = dialog.getButton(android.content.DialogInterface.BUTTON_NEGATIVE)
        assertTrue(positive.visibility == android.view.View.VISIBLE)
        assertTrue("no second button in notice mode", negative == null || negative.visibility != android.view.View.VISIBLE)
    }

    @Test
    fun `the single button of a notice is centred, not pushed to the right edge`() {
        val (_, dialog) = show(Recorder(notice = true))
        val positive = dialog.getButton(android.content.DialogInterface.BUTTON_POSITIVE)
        val bar = positive.parent as android.view.ViewGroup
        val visible = (0 until bar.childCount).map { bar.getChildAt(it) }.filter { it.visibility != android.view.View.GONE }
        org.junit.Assert.assertEquals("only the one button takes part in the bar's layout", listOf<android.view.View>(positive), visible)
        val gravity = when (bar) {
            is androidx.appcompat.widget.LinearLayoutCompat -> bar.gravity
            is android.widget.LinearLayout -> bar.gravity
            else -> throw AssertionError("unexpected button bar: ${bar.javaClass.name}")
        }
        org.junit.Assert.assertEquals(
            android.view.Gravity.CENTER_HORIZONTAL,
            gravity and android.view.Gravity.HORIZONTAL_GRAVITY_MASK,
        )
    }

    @Test
    fun `ask mode leaves the button bar as the platform lays it out`() {
        val (_, dialog) = show(Recorder(notice = false))
        val positive = dialog.getButton(android.content.DialogInterface.BUTTON_POSITIVE)
        val bar = positive.parent as android.view.ViewGroup
        val gravity = when (bar) {
            is androidx.appcompat.widget.LinearLayoutCompat -> bar.gravity
            is android.widget.LinearLayout -> bar.gravity
            else -> throw AssertionError("unexpected button bar: ${bar.javaClass.name}")
        }
        org.junit.Assert.assertNotEquals(
            android.view.Gravity.CENTER_HORIZONTAL,
            gravity and android.view.Gravity.HORIZONTAL_GRAVITY_MASK,
        )
    }

    @Test
    fun `closing the notice with back leads to the sheet, never to a dismissal`() {
        val rec = Recorder(notice = true)
        val (_, dialog) = show(rec)
        dialog.cancel()
        org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle()
        org.junit.Assert.assertEquals(1, rec.confirmed)
        org.junit.Assert.assertEquals(0, rec.dismissed)
    }

    @Test
    fun `ask mode keeps both buttons`() {
        val (_, dialog) = show(Recorder(notice = false))
        val negative = dialog.getButton(android.content.DialogInterface.BUTTON_NEGATIVE)
        assertTrue(negative != null && negative.visibility == android.view.View.VISIBLE)
    }
}
