# PromptSurge Android SDK

Adds a polished pre-prompt dialog before the Google Play In-App Review flow, increasing tap-through rates without violating App Store policies.

---

## Requirements

- Android minSdk 24+
- Kotlin 1.9+
- `androidx.fragment:fragment-ktx` (transitively satisfied by `appcompat`)

---

## Installation

Add JitPack to your root `settings.gradle.kts` (or `build.gradle.kts`):

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}
```

Then add the SDK to your module's `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.github.promptsurge:sdk-android:1.1.0")
}
```

Replace `1.1.0` with the [latest release tag](https://github.com/promptsurge/sdk-android/releases).

---

## Integration — two lines of code

### 1. Initialize (once per process)

Call in your `Application.onCreate()` or your launcher `Activity.onCreate()`:

```kotlin
import com.promptsurge.sdk.PromptSurge

class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        PromptSurge.initialize(this, "ps_live_your_api_key_here")
    }
}
```

`initialize()` is idempotent — safe to call with the same key multiple times (e.g. on re-entry to the activity). Calling it with a *different* key throws `IllegalStateException`.

### 2. Request a review

Call at a natural high-satisfaction moment (after a level complete, after a successful save, etc.):

```kotlin
import com.promptsurge.sdk.PromptSurge

// Inside a FragmentActivity (AppCompatActivity works too):
PromptSurge.requestReview(this)
```

The SDK handles everything else:
- Shows the pre-prompt dialog.
- If the user taps **"Sure"**, launches the Google Play In-App Review sheet.
- If the user taps **"Not now"**, dismisses with no action.
- Rate-limits automatically — silent no-op if the dialog was shown in the last 90 days, or dismissed in the last 7 days.

---

## Rate-limit behaviour

| Event | Cooldown |
|-------|----------|
| The dialog was shown at all | 90 days |
| User tapped "Not now" | 7 days (subsumed by the 90-day cooldown above) |

The 90-day cooldown starts the moment the dialog appears, not when a button is tapped. The dialog
is not cancelable, so a user who swipes the app away taps neither button; recording only on tap
left that user eligible again immediately, forever.

Cooldowns are stored in `SharedPreferences`. They survive app restarts.

## Impression limit behaviour

Each PromptSurge plan includes a monthly impression cap. When your app exceeds its cap, the API returns `402`. In that case, `requestReview()` automatically suppresses the pre-prompt dialog and fires the Google Play In-App Review sheet directly — so users still get the native prompt, just without the custom pre-prompt. The flag is cleared automatically when the next billing period begins.

---

## Debug helpers

```kotlin
// Clear all rate-limit state so you can test the flow repeatedly:
PromptSurge.clearRateLimitForTesting()

// See why a pre-prompt did or did not appear:
PromptSurge.setLogLevel(PromptSurge.LogLevel.DEBUG)
```

Guard `clearRateLimitForTesting()` with `if (BuildConfig.DEBUG)` in production apps.

Logging defaults to `WARN` — errors and warnings only, nothing on the happy path. Errors and
warnings are never silenced by default, because the failure they report (a rejected API key) is
otherwise invisible: the SDK would fall back to bundled English copy that looks like a working
install. The SDK never logs your API key.

---

## Themes

The dialog is built with Material 3. If your app's theme is a Material descendant, the dialog
inherits it. If it is not — a plain AppCompat theme, a platform theme, or a custom game theme —
the SDK falls back to its own bundled Material theme instead of crashing. You do not need to
change your app's theme to use the SDK.

Colours configured in the PromptSurge dashboard are applied on top of whichever of the two
applies.

---

## R8 / ProGuard

Nothing to do. The AAR ships `consumer-rules.pro`, and the sample app in this repository is built
with `isMinifyEnabled = true` on every CI run so those rules stay honest.

---

## App Store policy note

The pre-prompt is informational — it does **not** gate the native review prompt on the user's sentiment. Both buttons ("Sure" and "Not now") lead to the same outcome: native prompt or neutral dismiss. This design preserves compatibility with Apple App Store rule 5.6.1 for the future iOS port.

---

## API reference

| Method | Description |
|--------|-------------|
| `PromptSurge.initialize(context, apiKey)` | Initialize the SDK. Call once. A blank key is rejected with a logged error and leaves the SDK uninitialized. |
| `PromptSurge.requestReview(activity)` | Show pre-prompt and, on confirm, launch Play review. Rate-limited internally. Safe to call from an async callback: a no-op if the activity is finishing, its state is already saved, or the dialog is already up. |
| `PromptSurge.setLocaleOverride(locale)` | Force a locale for the prompt copy, or `null` to follow the device. |
| `PromptSurge.optOut(context)` / `optIn(context)` | Honour a user's explicit "never ask me for reviews" preference. Persisted. |
| `PromptSurge.setLogLevel(level)` | `NONE`, `ERROR`, `WARN` (default), `INFO`, `DEBUG`. |
| `PromptSurge.clearRateLimitForTesting()` | Reset cooldown timestamps. Debug only. |

---

## What the SDK collects

One value: a per-install, per-app identifier, defined as `SHA-256(ANDROID_ID + your package name)`.
The raw `ANDROID_ID` is never stored, transmitted, or logged, and hashing with your package name
means the same device produces a different identifier in every app, so it cannot be used to
correlate a user across apps. No advertising identifier is used anywhere.

For Play Data Safety, this is a device or other ID, collected and transmitted, used for analytics,
not linked to a user's identity, and not shared with third parties beyond PromptSurge.
