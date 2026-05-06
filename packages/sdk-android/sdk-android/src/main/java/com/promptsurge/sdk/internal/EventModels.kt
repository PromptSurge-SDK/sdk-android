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
    val payload: JsonObject = buildJsonObject {},
)

@Serializable
internal data class EventBatchDto(
    @SerialName("events") val events: List<EventDto>,
)

internal object EventTypes {
    const val FIRST_OPEN = "first_open"
    const val INITIALIZE = "initialize"
    const val PRE_PROMPT_SHOWN = "pre_prompt_shown"
    const val PRE_PROMPT_CONFIRMED = "pre_prompt_confirmed"
    const val PRE_PROMPT_DISMISSED = "pre_prompt_dismissed"
    const val NATIVE_PROMPT_REQUESTED = "native_prompt_requested"
}
