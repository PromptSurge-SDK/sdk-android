package com.promptsurge.sdk.internal

import android.content.Context
import android.util.Log
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
                .onFailure { Log.w(TAG, "prefetch failed: ${it.message}") }
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

        val fetched = runCatching { fetch(locale) }.getOrNull()
        if (fetched != null) {
            writeCache(locale, fetched, now)
            memCache = CachedPrompt(locale, now, fetched)
            return@withLock fetched
        }

        readCacheForLocale(locale, now, requireFresh = false)?.let {
            Log.w(TAG, "Live fetch failed; serving stale cache for locale=$locale")
            memCache = CachedPrompt(locale, it.let { now }, it) // keep memCache in sync
            return@withLock it
        }

        readAnyCache()?.let {
            Log.w(TAG, "Live fetch failed; no cache for $locale, serving last-known $it")
            return@withLock it
        }

        Log.w(TAG, "No cache and live fetch failed; serving bundled English defaults")
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
        return PromptText(resolved, title, body, ctaConfirm, ctaDismiss, imageUrl)
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
            putLong(KEY_CACHED_AT, now)
            apply()
        }
    }

    private suspend fun fetch(locale: String): PromptText = withContext(ioDispatcher) {
        val raw = httpClient.get("/v1/prompts?locale=${java.net.URLEncoder.encode(locale, "UTF-8")}")
        val parsed = json.decodeFromString(PromptResponse.serializer(), raw)
        PromptText(
            locale = parsed.locale,
            title = parsed.title,
            body = parsed.body,
            ctaConfirm = parsed.ctaConfirm,
            ctaDismiss = parsed.ctaDismiss,
            imageUrl = parsed.imageUrl,
        )
    }

    /** Test-only: wipe everything (memory + disk). */
    internal fun resetForTesting() {
        memCache = null
        prefs.edit().clear().apply()
    }

    @Serializable
    internal data class PromptResponse(
        val locale: String,
        val title: String,
        val body: String,
        val ctaConfirm: String,
        val ctaDismiss: String,
        val imageUrl: String? = null,
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

internal class OkHttpGetClient(
    private val client: OkHttpClient,
    private val baseUrl: String,
    private val apiKey: String,
) : PromptTextRepository.HttpClient {
    override suspend fun get(path: String): String {
        val url = baseUrl.trimEnd('/') + path
        val request = Request.Builder()
            .url(url)
            .addHeader("X-PromptSurge-Key", apiKey)
            .get()
            .build()
        client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) error("HTTP ${resp.code}")
            return resp.body?.string() ?: error("empty body")
        }
    }
}
