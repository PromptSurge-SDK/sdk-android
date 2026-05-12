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
    implementation("com.github.promptsurge:sdk-android:0.1.0")
}
```

Replace `0.1.0` with the [latest release tag](https://github.com/promptsurge/sdk-android/releases).

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
| User saw the dialog and tapped "Sure" | 90 days |
| User tapped "Not now" | 7 days |

Cooldowns are stored in `SharedPreferences`. They survive app restarts.

## Impression limit behaviour

Each PromptSurge plan includes a monthly impression cap. When your app exceeds its cap, the API returns `402`. In that case, `requestReview()` automatically suppresses the pre-prompt dialog and fires the Google Play In-App Review sheet directly — so users still get the native prompt, just without the custom pre-prompt. The flag is cleared automatically when the next billing period begins.

---

## Debug helpers

```kotlin
// Clear all rate-limit state so you can test the flow repeatedly:
PromptSurge.clearRateLimitForTesting()
```

Guard this call with `if (BuildConfig.DEBUG)` in production apps.

---

## App Store policy note

The pre-prompt is informational — it does **not** gate the native review prompt on the user's sentiment. Both buttons ("Sure" and "Not now") lead to the same outcome: native prompt or neutral dismiss. This design preserves compatibility with Apple App Store rule 5.6.1 for the future iOS port.

---

## API reference

| Method | Description |
|--------|-------------|
| `PromptSurge.initialize(context, apiKey)` | Initialize the SDK. Call once. |
| `PromptSurge.requestReview(activity)` | Show pre-prompt and, on confirm, launch Play review. Rate-limited internally. |
| `PromptSurge.clearRateLimitForTesting()` | Reset cooldown timestamps. Debug only. |
