package com.promptsurge.sdk.internal

import android.util.Log

/**
 * Leveled logging for the SDK.
 *
 * Errors and warnings always emit: a shipped build that silently swallows "your API key was
 * rejected" is how an integrator ends up shipping bundled English copy to every user without
 * ever seeing a hint. Info and debug are off unless the host opts in via
 * `PromptSurge.setLogLevel(...)`, so a release build stays quiet on the happy path.
 *
 * Nothing here ever logs the API key, in whole or in part.
 */
internal object PsLog {

    /** Verbosity of SDK logging. [WARN] is the default: errors and warnings only. */
    enum class Level(internal val rank: Int) {
        /** Nothing at all, including errors. Opt-in only. */
        NONE(0),

        /** Errors only. */
        ERROR(1),

        /** Errors and warnings. The default. */
        WARN(2),

        /** Adds one line per significant decision (rate-limited, holdout, warm-up, ...). */
        INFO(3),

        /** Adds delivery detail: cache hits, fetch outcomes, event queueing. */
        DEBUG(4),
    }

    @Volatile
    var level: Level = Level.WARN

    fun e(tag: String, message: String, t: Throwable? = null) {
        if (level.rank >= Level.ERROR.rank) {
            if (t != null) Log.e(tag, message, t) else Log.e(tag, message)
        }
    }

    fun w(tag: String, message: String) {
        if (level.rank >= Level.WARN.rank) Log.w(tag, message)
    }

    fun i(tag: String, message: String) {
        if (level.rank >= Level.INFO.rank) Log.i(tag, message)
    }

    fun d(tag: String, message: String) {
        if (level.rank >= Level.DEBUG.rank) Log.d(tag, message)
    }
}
