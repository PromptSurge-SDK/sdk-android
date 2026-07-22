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
 * These are the absolute last resort — used only when the device has no cached server response
 * AND the live fetch fails. They match the M1 hardcoded copy verbatim so a brand-new install
 * with no network connectivity still shows reasonable English text.
 *
 * Not in `strings.xml` because these are SDK-internal — host apps shouldn't override them.
 */
internal object PromptDefaults {
    const val LOCALE = "en"
    const val TITLE = "Enjoying this app?"
    const val BODY = "Reviews help other people discover apps like this. Got a moment?"
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
 * `imageUrl` is optional — when non-null the dialog renders it as a header image above the title.
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
)
