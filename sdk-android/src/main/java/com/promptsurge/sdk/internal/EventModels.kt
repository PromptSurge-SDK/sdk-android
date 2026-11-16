package com.promptsurge.sdk.internal

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject

/**
 * Wire format for an analytics event. Mirrors the Zod schema in `@promptsurge/shared-types`.
 *
 * `payload` is intentionally a free-form JsonObject — each event type carries its own shape
 * (today only `first_open` has a non-empty payload). Keeping it open here avoids a parallel
 * sealed hierarchy that would have to be maintained alongside the server-side schema.
 */
@Serializable
internal data class EventDto(
    val eventType: String,
    val eventId: String,
    val timestamp: String,
    val sessionId: String,
    val deviceId: String,
    val appVersion: String,
    val sdkVersion: String,
    val locale: String,
    val platform: String,
    val holdout: Boolean = false,
    val payload: JsonObject = buildJsonObject {},
)

/**
 * `verifyToken` is the one-shot app-ownership token generated in the admin panel. The server has
 * accepted it on this endpoint all along, but no SDK ever sent one, so app verification was
 * unreachable from every platform. Omitted from the JSON when null - the server's schema declares
 * it `.optional()`, which rejects an explicit null.
 */
@Serializable
internal data class EventBatchDto(
    @SerialName("events") val events: List<EventDto>,
    @SerialName("verifyToken") val verifyToken: String? = null,
)

/**
 * Card 349 phase 4: what `POST /v1/events` answers with.
 *
 * `assignment` is present only when the batch spoke for exactly one device AND the server had
 * or could create a row for it. It is the group the SERVER remembers for a `deviceId` that
 * survives a reinstall, and it is the whole point of the feature: app preferences do not
 * survive an uninstall, so without this a reinstalling device flips the coin again and is
 * counted in both groups under one id.
 *
 * `accepted` and `skipped` are parsed because they are there, not because anything reads them
 * yet - `ignoreUnknownKeys` means a field the server adds later cannot break a flush.
 */
@Serializable
internal data class EventBatchResponseDto(
    val accepted: Int = 0,
    val skipped: Int = 0,
    val assignment: AssignmentDto? = null,
)

@Serializable
internal data class AssignmentDto(val holdout: Boolean)

internal object EventTypes {
    const val FIRST_OPEN = "first_open"
    const val INITIALIZE = "initialize"
    const val PRE_PROMPT_SHOWN = "pre_prompt_shown"
    const val PRE_PROMPT_CONFIRMED = "pre_prompt_confirmed"
    const val PRE_PROMPT_DISMISSED = "pre_prompt_dismissed"
    const val NATIVE_PROMPT_REQUESTED = "native_prompt_requested"

    /** Card 833: how long the app was away after asking Play for the review flow (`awayMs`). */
    const val NATIVE_SHEET_CLOSED = "native_sheet_closed"
}
