package com.promptsurge.sdk.internal

import android.content.Context
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.promptsurge.sdk.BuildConfig
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.ArrayDeque
import java.util.concurrent.TimeUnit

/**
 * In-memory event queue with periodic + on-background flush.
 *
 * Design notes:
 *  - Bounded queue (max [MAX_QUEUE]). When full, oldest events are dropped to make room.
 *    We pick "drop oldest" over "drop new" so the most recent activity is preserved if the
 *    device is offline for an extended period.
 *  - Periodic flush every [FLUSH_INTERVAL_MS]; immediate flush when the app goes to background
 *    via ProcessLifecycleOwner. Both paths share the same [flushNow] critical section.
 *  - Network failures retry with exponential backoff (1s, 2s, 4s) up to [MAX_ATTEMPTS] total.
 *    After that the batch is dropped — better to lose telemetry than to grow the queue forever.
 *  - All public methods are safe to call before [start]; events queue silently and are sent on
 *    the first flush after start.
 */
internal class EventBus internal constructor(
    private val httpClient: HttpClient,
    private val clock: () -> Long,
    private val ioDispatcher: CoroutineDispatcher,
    private val flushIntervalMs: Long,
) {

    private val queue = ArrayDeque<EventDto>()
    private val mutex = Mutex()
    private var scope: CoroutineScope? = null
    private var periodicJob: Job? = null
    private var lifecycleObserver: DefaultLifecycleObserver? = null
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    fun enqueue(event: EventDto) {
        synchronized(queue) {
            if (queue.size >= MAX_QUEUE) {
                queue.pollFirst() // drop oldest
            }
            queue.add(event)
        }
    }

    /** Snapshot of current queue size — for tests + debug logs only. */
    fun queueSize(): Int = synchronized(queue) { queue.size }

    /** Start the bus: register lifecycle observer and begin periodic flushes. Idempotent. */
    fun start(applicationContext: Context) {
        if (scope != null) return
        val cs = CoroutineScope(SupervisorJob() + ioDispatcher)
        scope = cs

        periodicJob = cs.launch {
            while (isActive) {
                delay(flushIntervalMs)
                runCatching { flushNow() }.onFailure {
                    PsLog.w(TAG, "Periodic flush failed: ${it.message}")
                }
            }
        }

        // Register on the main thread — ProcessLifecycleOwner requires it.
        applicationContext.let {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                val observer = object : DefaultLifecycleObserver {
                    override fun onStop(owner: LifecycleOwner) {
                        // App went to background → flush.
                        cs.launch {
                            runCatching { flushNow() }.onFailure {
                                PsLog.w(TAG, "Background flush failed: ${it.message}")
                            }
                        }
                    }
                }
                lifecycleObserver = observer
                ProcessLifecycleOwner.get().lifecycle.addObserver(observer)
            }
        }
    }

    fun stop() {
        periodicJob?.cancel()
        periodicJob = null
        scope?.coroutineContext?.get(Job)?.cancel()
        scope = null
        lifecycleObserver?.let {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                ProcessLifecycleOwner.get().lifecycle.removeObserver(it)
            }
        }
        lifecycleObserver = null
    }

    suspend fun flushNow(): FlushResult = mutex.withLock {
        val batch: List<EventDto> = synchronized(queue) {
            if (queue.isEmpty()) return@withLock FlushResult.Empty
            val drained = queue.toList()
            queue.clear()
            drained
        }

        var attempt = 0
        var backoffMs = INITIAL_BACKOFF_MS
        while (true) {
            attempt += 1
            val result = runCatching {
                val body = json.encodeToString(EventBatchDto.serializer(), EventBatchDto(batch))
                httpClient.post("/v1/events", body)
            }
            if (result.isSuccess && result.getOrNull()?.success == true) {
                return@withLock FlushResult.Sent(batch.size, attempt)
            }
            val errMsg = result.exceptionOrNull()?.message ?: result.getOrNull()?.errorMessage
            PsLog.d(TAG, "Flush attempt $attempt failed: $errMsg")
            if (attempt >= MAX_ATTEMPTS) {
                PsLog.w(TAG, "Dropping batch of ${batch.size} events after $MAX_ATTEMPTS attempts")
                return@withLock FlushResult.Dropped(batch.size)
            }
            delay(backoffMs)
            backoffMs *= 2
        }
        @Suppress("UNREACHABLE_CODE") FlushResult.Dropped(batch.size)
    }

    sealed interface FlushResult {
        data object Empty : FlushResult
        data class Sent(val count: Int, val attempts: Int) : FlushResult
        data class Dropped(val count: Int) : FlushResult
    }

    companion object {
        private const val TAG = "PromptSurgeEventBus"
        internal const val MAX_QUEUE = 200
        internal const val FLUSH_INTERVAL_MS = 30_000L
        internal const val INITIAL_BACKOFF_MS = 1_000L
        internal const val MAX_ATTEMPTS = 3

        /** Production constructor: real OkHttp client targeting BuildConfig.PROMPTSURGE_API_URL. */
        fun create(apiKey: String, baseUrl: String = BuildConfig.PROMPTSURGE_API_URL): EventBus {
            val client = OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()
            val http = OkHttpHttpClient(client, baseUrl, apiKey)
            return EventBus(
                httpClient = http,
                clock = System::currentTimeMillis,
                ioDispatcher = Dispatchers.IO,
                flushIntervalMs = FLUSH_INTERVAL_MS,
            )
        }
    }
}

internal interface HttpClient {
    suspend fun post(path: String, jsonBody: String): HttpResponse
}

internal data class HttpResponse(val success: Boolean, val code: Int, val errorMessage: String? = null)

internal class OkHttpHttpClient(
    private val client: OkHttpClient,
    private val baseUrl: String,
    private val apiKey: String,
) : HttpClient {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    override suspend fun post(path: String, jsonBody: String): HttpResponse {
        val url = baseUrl.trimEnd('/') + path
        val request = Request.Builder()
            .url(url)
            .addHeader("X-PromptSurge-Key", apiKey)
            .post(jsonBody.toRequestBody(jsonMediaType))
            .build()
        return try {
            client.newCall(request).execute().use { resp ->
                HttpResponse(
                    success = resp.isSuccessful,
                    code = resp.code,
                    errorMessage = if (resp.isSuccessful) null else "HTTP ${resp.code}",
                )
            }
        } catch (t: Throwable) {
            HttpResponse(success = false, code = 0, errorMessage = t.message)
        }
    }
}
