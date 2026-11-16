package com.promptsurge.sdk.internal

import kotlinx.serialization.Serializable

@Serializable
internal data class DialogTheme(
    val presetId: String,
    val accentColor: String,
    val backgroundColor: String,
    val textColor: String,
    val buttonTextColor: String,
)

/**
 * Bundled English defaults for the pre-prompt dialog.
 *
 * These are the absolute last resort - used only when the device has no cached server response
 * AND the live fetch fails. They match the iOS SDK's `defaultPromptText`, the Unity SDK's
 * `Defaults` and the server's hardcoded fallback verbatim, so a brand-new install with no
 * network connectivity shows the same English text on every platform.
 *
 * Not in `strings.xml` because these are SDK-internal - host apps shouldn't override them.
 *
 * The copy is a statement, not a question, and must stay one. Two rules meet here:
 *  - Google's in-app review guidance says an app should not ask the user any questions before
 *    or while presenting the rating button or card. "Leave a review?" was already a question, so
 *    the default now asks nothing at all and the buttons carry the choice.
 *  - The no-satisfaction-question rule (Apple 5.6.1, Google Play in-app review policy): only the
 *    confirm button opens the review flow, so an "Are you enjoying...?" title would make this a
 *    sentiment filter. Same rule for the seeded global prompts and for LLM-generated copy. See
 *    `docs/conventions.md`.
 */
internal object PromptDefaults {
    const val LOCALE = "en"
    const val TITLE = "A quick favor"
    const val BODY = "A short review helps other people discover apps like this."
    const val CTA_CONFIRM = "Sure"
    const val CTA_DISMISS = "Not now"

    fun asPromptText(): PromptText = PromptText(
        locale = LOCALE,
        title = TITLE,
        body = BODY,
        ctaConfirm = CTA_CONFIRM,
        ctaDismiss = CTA_DISMISS,
        imageUrl = null,
    )
}

/**
 * Resolved pre-prompt copy for a given locale. The `locale` field reflects what the server
 * actually served (after fallback resolution), not what the client asked for.
 * `imageUrl` is optional - when non-null the dialog renders it as a header image above the title.
 */
internal data class PromptText(
    val locale: String,
    val title: String,
    val body: String,
    val ctaConfirm: String,
    val ctaDismiss: String,
    val imageUrl: String? = null,
    val theme: DialogTheme? = null,
    val promptNumber: Int? = null,
    /** Id of the PromptText row the server served, echoed back on every event for A/B attribution. */
    val promptId: String? = null,
    /**
     * True when the server answered `mode: "notice"` (card 833): draw ONE button and request the
     * store's sheet however the dialog closes. False is the two-button ask.
     */
    val notice: Boolean = false,
)
