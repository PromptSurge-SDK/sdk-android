package com.promptsurge.sdk.internal

import android.content.Context
import com.promptsurge.sdk.BuildConfig
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * Owns the server-driven pre-prompt copy.
 *
 * Resolution order at call time (`getCurrentText`):
 *   1. Fresh in-memory cache (≤ TTL) for the active locale → return immediately.
 *   2. Persisted SharedPreferences cache for the active locale (≤ TTL) → return + warm memory.
 *   3. Live fetch from `/v1/prompts?locale=<active>` → on success, cache + return.
 *   4. Stale persisted cache for the active locale (any age) → return.
 *   5. Stale persisted cache for any locale (last-known-good) → return.
 *   6. Bundled English defaults — cannot fail.
 *
 * Active locale = locale override (if set via [setLocaleOverride]) else `Locale.getDefault().toLanguageTag()`.
 *
 * The repository is intentionally robust against network/server failure: a user who installs the
 * SDK on a flight should still see a reasonable pre-prompt rather than nothing.
 */
internal class PromptTextRepository internal constructor(
    private val appContext: Context,
    private val httpClient: HttpClient,
    private val clock: () -> Long,
    private val ioDispatcher: CoroutineDispatcher,
    private val ttlMs: Long = DEFAULT_TTL_MS,
) {

    private val prefs by lazy {
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /** Returns true if the server has signalled that this app has been deleted. */
    fun isAppDeleted(): Boolean = prefs.getBoolean(KEY_APP_DELETED, false)

    /**
     * True if the server rejected the API key (401/403) at any point this process.
     *
     * Deliberately in-memory rather than persisted, unlike [isAppDeleted]: a key can be fixed by
     * a config change on the server side, and a persisted flag would keep the SDK dark on a
     * device that is now perfectly fine. A fresh process re-tests the key on the first prefetch.
     */
    @Volatile private var unauthorized = false

    fun isUnauthorized(): Boolean = unauthorized

    /** Returns true if the impression limit for the current billing tier has been reached. */
    fun isImpressionLimitExceeded(): Boolean = prefs.getBoolean(KEY_IMPRESSION_LIMIT_EXCEEDED, false)

    /**
     * Returns true while the app is in the mandatory warm-up phase (server signalled warmup:true
     * on the last fetch). During warm-up, [PromptSurge.requestReview] fires native review directly
     * without showing the pre-prompt dialog. The flag clears automatically once the server
     * confirms the threshold has been crossed (warmup:false on the next fetch).
     */
    fun isWarmupActive(): Boolean = prefs.getBoolean(KEY_WARMUP_ACTIVE, false)
    private val mutex = Mutex()
    private val json = Json { ignoreUnknownKeys = true }

    @Volatile private var memCache: CachedPrompt? = null

    fun setLocaleOverride(locale: String?) {
        prefs.edit().apply {
            if (locale.isNullOrBlank()) remove(KEY_OVERRIDE) else putString(KEY_OVERRIDE, locale)
            apply()
        }
        memCache = null
    }

    fun activeLocale(): String =
        prefs.getString(KEY_OVERRIDE, null)?.takeIf { it.isNotBlank() }
            ?: Locale.getDefault().toLanguageTag()

    /**
     * Synchronous best-effort lookup: returns memory cache → disk cache (active locale, any age)
     * → disk cache (any locale) → bundled defaults. Never blocks on network. Use this from UI code.
     */
    fun getCachedOrDefaults(): PromptText {
        val locale = activeLocale()
        memCache?.takeIf { it.requestedLocale == locale }?.let { return it.text }
        readCacheForLocale(locale, clock(), requireFresh = false)?.let { return it }
        readAnyCache()?.let { return it }
        return PromptDefaults.asPromptText()
    }

    /** Fire-and-forget fetch; safe to call on initialize(). Errors logged, never thrown. */
    fun prefetch() {
        CoroutineScope(SupervisorJob() + ioDispatcher).launch {
            runCatching { getCurrentText() }
                .onFailure { PsLog.w(TAG, "prefetch failed: ${it.message}") }
        }
    }

    suspend fun getCurrentText(): PromptText = mutex.withLock {
        val locale = activeLocale()
        val now = clock()

        memCache?.takeIf { it.requestedLocale == locale && (now - it.cachedAt) <= ttlMs }?.let {
            return@withLock it.text
        }

        readCacheForLocale(locale, now, requireFresh = true)?.let {
            memCache = CachedPrompt(locale, now, it)
            return@withLock it
        }

        val fetchResult = runCatching { fetch(locale) }
        if (fetchResult.exceptionOrNull() is UnauthorizedException) {
            unauthorized = true
            PsLog.e(
                TAG,
                "The server rejected this API key (401/403). No pre-prompt will be shown. " +
                    "Check the key in your PromptSurge dashboard is an Android key and is active.",
            )
            return@withLock PromptDefaults.asPromptText() // caller checks isUnauthorized() before showing
        }
        if (fetchResult.exceptionOrNull() is AppDeletedException) {
            prefs.edit().putBoolean(KEY_APP_DELETED, true).apply()
            PsLog.w(TAG, "App has been deleted server-side; pre-prompt will be suppressed.")
            return@withLock PromptDefaults.asPromptText() // caller checks isAppDeleted() before showing
        }
        if (fetchResult.exceptionOrNull() is ImpressionLimitExceededException) {
            prefs.edit().putBoolean(KEY_IMPRESSION_LIMIT_EXCEEDED, true).apply()
            PsLog.w(TAG, "Impression limit exceeded; pre-prompt will be suppressed, native IAR will fire directly.")
            return@withLock PromptDefaults.asPromptText() // caller checks isImpressionLimitExceeded() before showing
        }
        val fetched = fetchResult.getOrNull()
        if (fetched != null) {
            unauthorized = false
            // Both suppressions clear on a 200: app_deleted used to be a one-way kill switch, so
            // a single 404 during a deploy disabled the SDK on that install permanently.
            prefs.edit()
                .putBoolean(KEY_IMPRESSION_LIMIT_EXCEEDED, false)
                .putBoolean(KEY_APP_DELETED, false)
                .apply()
            // Persist warm-up state so requestReview() can read it synchronously.
            // Clear flag when server confirms warm-up is complete (warmup=false).
            prefs.edit().putBoolean(KEY_WARMUP_ACTIVE, fetched.warmup).apply()
            val promptText = fetched.toPromptText()
            // Do not cache warm-up responses — they must stay live so the threshold
            // counter can advance and warm-up completion is detected on the next fetch.
            if (!fetched.warmup) {
                writeCache(locale, promptText, now)
                memCache = CachedPrompt(locale, now, promptText)
            }
            return@withLock promptText
        }

        readCacheForLocale(locale, now, requireFresh = false)?.let {
            PsLog.w(TAG, "Live fetch failed; serving stale cache for locale=$locale")
            memCache = CachedPrompt(locale, it.let { now }, it) // keep memCache in sync
            return@withLock it
        }

        readAnyCache()?.let {
            PsLog.w(TAG, "Live fetch failed; no cache for $locale, serving last-known $it")
            return@withLock it
        }

        PsLog.w(TAG, "No cache and live fetch failed; serving bundled English defaults")
        return@withLock PromptDefaults.asPromptText()
    }

    private fun readCacheForLocale(locale: String, now: Long, requireFresh: Boolean): PromptText? {
        val cachedLocale = prefs.getString(KEY_REQUESTED_LOCALE, null) ?: return null
        if (cachedLocale != locale) return null
        val cachedAt = prefs.getLong(KEY_CACHED_AT, 0L)
        if (requireFresh && (now - cachedAt) > ttlMs) return null
        return readCachedPromptText()
    }

    private fun readAnyCache(): PromptText? {
        if (prefs.getString(KEY_REQUESTED_LOCALE, null) == null) return null
        return readCachedPromptText()
    }

    private fun readCachedPromptText(): PromptText? {
        val resolved = prefs.getString(KEY_RESOLVED_LOCALE, null) ?: return null
        val title = prefs.getString(KEY_TITLE, null) ?: return null
        val body = prefs.getString(KEY_BODY, null) ?: return null
        val ctaConfirm = prefs.getString(KEY_CTA_CONFIRM, null) ?: return null
        val ctaDismiss = prefs.getString(KEY_CTA_DISMISS, null) ?: return null
        val imageUrl = prefs.getString(KEY_IMAGE_URL, null)
        val themeJson = prefs.getString(KEY_THEME, null)
        val theme = themeJson?.let { runCatching { json.decodeFromString(DialogTheme.serializer(), it) }.getOrNull() }
        val promptNumber = prefs.getInt(KEY_PROMPT_NUMBER, -1).takeIf { it >= 0 }
        val promptId = prefs.getString(KEY_PROMPT_ID, null)
        return PromptText(resolved, title, body, ctaConfirm, ctaDismiss, imageUrl, theme, promptNumber, promptId)
    }

    private fun writeCache(requestedLocale: String, text: PromptText, now: Long) {
        prefs.edit().apply {
            putString(KEY_REQUESTED_LOCALE, requestedLocale)
            putString(KEY_RESOLVED_LOCALE, text.locale)
            putString(KEY_TITLE, text.title)
            putString(KEY_BODY, text.body)
            putString(KEY_CTA_CONFIRM, text.ctaConfirm)
            putString(KEY_CTA_DISMISS, text.ctaDismiss)
            if (text.imageUrl != null) putString(KEY_IMAGE_URL, text.imageUrl) else remove(KEY_IMAGE_URL)
            if (text.theme != null) putString(KEY_THEME, json.encodeToString(DialogTheme.serializer(), text.theme)) else remove(KEY_THEME)
            if (text.promptNumber != null) putInt(KEY_PROMPT_NUMBER, text.promptNumber) else remove(KEY_PROMPT_NUMBER)
            if (text.promptId != null) putString(KEY_PROMPT_ID, text.promptId) else remove(KEY_PROMPT_ID)
            putLong(KEY_CACHED_AT, now)
            apply()
        }
    }

    private suspend fun fetch(locale: String): PromptResponse = withContext(ioDispatcher) {
        // appVersion drives per-version warm-up buckets server-side. Use the same value
        // the SDK reports on events so the device counts line up. Older servers ignore it.
        val version = try {
            @Suppress("DEPRECATION")
            appContext.packageManager.getPackageInfo(appContext.packageName, 0).versionName ?: "unknown"
        } catch (_: Exception) {
            "unknown"
        }
        val raw = httpClient.get(
            "/v1/prompts?locale=${java.net.URLEncoder.encode(locale, "UTF-8")}" +
                "&appVersion=${java.net.URLEncoder.encode(version, "UTF-8")}",
        )
        json.decodeFromString(PromptResponse.serializer(), raw)
    }

    private fun PromptResponse.toPromptText() = PromptText(
        locale = locale,
        title = title,
        body = body,
        ctaConfirm = ctaConfirm,
        ctaDismiss = ctaDismiss,
        imageUrl = imageUrl,
        theme = theme,
        promptNumber = promptNumber,
        promptId = promptId,
    )

    /** Test-only: wipe everything (memory + disk). */
    internal fun resetForTesting() {
        memCache = null
        prefs.edit().clear().apply()
    }

    /** Test-only: clear the app_deleted flag. */
    internal fun clearAppDeletedForTesting() {
        prefs.edit().remove(KEY_APP_DELETED).apply()
    }

    /** Test-only: clear the warmup_active flag. */
    internal fun clearWarmupForTesting() {
        prefs.edit().remove(KEY_WARMUP_ACTIVE).apply()
    }

    @Serializable
    internal data class PromptResponse(
        val locale: String,
        val title: String,
        val body: String,
        val ctaConfirm: String,
        val ctaDismiss: String,
        val imageUrl: String? = null,
        val theme: DialogTheme? = null,
        val promptNumber: Int? = null,
        val promptId: String? = null,
        /** True during the mandatory warm-up phase. SDK fires native review without dialog. */
        val warmup: Boolean = false,
    )

    private data class CachedPrompt(
        val requestedLocale: String,
        val cachedAt: Long,
        val text: PromptText,
    )

    interface HttpClient {
        suspend fun get(path: String): String
    }

    companion object {
        private const val TAG = "PromptSurgePromptText"
        private const val PREFS_NAME = "ps_prompt_text"
        private const val KEY_OVERRIDE = "locale_override"
        private const val KEY_REQUESTED_LOCALE = "requested_locale"
        private const val KEY_RESOLVED_LOCALE = "resolved_locale"
        private const val KEY_TITLE = "title"
        private const val KEY_BODY = "body"
        private const val KEY_CTA_CONFIRM = "cta_confirm"
        private const val KEY_CTA_DISMISS = "cta_dismiss"
        private const val KEY_CACHED_AT = "cached_at"
        private const val KEY_IMAGE_URL = "image_url"
        private const val KEY_APP_DELETED = "app_deleted"
        private const val KEY_IMPRESSION_LIMIT_EXCEEDED = "impression_limit_exceeded"
        private const val KEY_WARMUP_ACTIVE = "warmup_active"
        private const val KEY_THEME = "dialog_theme"
        private const val KEY_PROMPT_NUMBER = "prompt_number"
        private const val KEY_PROMPT_ID = "prompt_id"

        internal const val DEFAULT_TTL_MS: Long = 24L * 60 * 60 * 1000

        fun create(
            context: Context,
            apiKey: String,
            baseUrl: String = BuildConfig.PROMPTSURGE_API_URL,
        ): PromptTextRepository {
            val client = OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()
            val http = OkHttpGetClient(client, baseUrl, apiKey)
            return PromptTextRepository(
                appContext = context.applicationContext,
                httpClient = http,
                clock = System::currentTimeMillis,
                ioDispatcher = Dispatchers.IO,
            )
        }
    }
}

/** Thrown when the server responds 404 with error=app_deleted. */
internal class AppDeletedException : Exception("app_deleted")

/** Thrown when the server responds 402 — impression limit exceeded for current tier. */
internal class ImpressionLimitExceededException : Exception("impression_limit_exceeded")

/** Thrown when the server responds 401/403 — the API key is missing, wrong, or inactive. */
internal class UnauthorizedException(code: Int) : Exception("unauthorized_$code")

/** Shape of the server's error bodies: `{ "error": "app_deleted" }`. */
@Serializable
private data class ApiError(val error: String? = null)

internal class OkHttpGetClient(
    private val client: OkHttpClient,
    private val baseUrl: String,
    private val apiKey: String,
) : PromptTextRepository.HttpClient {

    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun get(path: String): String {
        val url = baseUrl.trimEnd('/') + path
        val request = Request.Builder()
            .url(url)
            .addHeader("X-PromptSurge-Key", apiKey)
            .get()
            .build()
        client.newCall(request).execute().use { resp ->
            if (resp.code == 401 || resp.code == 403) throw UnauthorizedException(resp.code)
            if (resp.code == 404) {
                // Match the parsed `error` field, not a substring of the body: an unrelated 404
                // whose body merely mentions the string used to permanently disable the SDK.
                val body = resp.body?.string() ?: ""
                val parsed = runCatching { json.decodeFromString(ApiError.serializer(), body) }.getOrNull()
                if (parsed?.error == "app_deleted") throw AppDeletedException()
            }
            if (resp.code == 402) throw ImpressionLimitExceededException()
            if (!resp.isSuccessful) error("HTTP ${resp.code}")
            return resp.body?.string() ?: error("empty body")
        }
    }
}
