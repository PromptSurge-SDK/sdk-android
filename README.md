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
    implementation("com.github.PromptSurge-SDK:sdk-android:1.1.0")
}
```

Replace `1.1.0` with the [latest release tag](https://github.com/PromptSurge-SDK/sdk-android/tags). CI tags the mirror from `VERSION_NAME` in `gradle.properties`, and never moves a tag that already exists.

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

## Nothing is showing and I do not know why

The default level is **WARN**, so errors and warnings reach you — a rejected key, a spent impression
cap and a deleted app all print. But **warm-up, holdout and the cooldowns are INFO**, and those are
every reason a correctly wired integration shows nothing. The most confusing case is the quietest
one, so ask for it:

```kotlin
PromptSurge.setLogLevel(PromptSurge.LogLevel.INFO)
```

Do that first. Then filter logcat for `PromptSurge`. In suppression order:

| What you will see | What it means |
|---|---|
| `requestReview: the server rejected this API key (401/403)...` (error) | Always prints. Check the key is an **Android** key and is active. |
| `App has been deleted server-side...` (warning) | Always prints. Restore the app in the dashboard to clear it. |
| `Impression limit exceeded...` (warning) | Always prints. Plan cap spent; clears when the billing period rolls over. |
| `requestReview: warm-up phase — skipping dialog, firing native review for baseline.` | **The one that catches every new integration.** See below. |
| `requestReview: holdout group — skipping dialog, attempting native IAR.` | This device is in the 10% control group, for its lifetime. Try another device. |
| *(cooldown)* nothing shown | Already shown (90 days) or dismissed (7 days) on this device. `clearRateLimitForTesting()` resets it. |

In every one of these cases the **native** Play In-App Review sheet still fires. A missing
pre-prompt does not mean nothing happened — and Play's own sheet is quota-limited and often shows
nothing on a debug build, so an invisible native sheet is normal too.

## Warm-up phase

A brand-new app shows **no pre-prompt at all** until it has recorded **50 distinct devices** firing
`native_prompt_requested`. Until then every `requestReview()` fires the Play In-App Review sheet
directly, which is what builds the baseline the whole product measures lift against. Default mode is
`once` — one warm-up for the app's lifetime, not per release.

**A test device will never reach 50 on its own**, so this is the expected state during an
integration rather than a bug. Turn it off for an app from its overview page in the dashboard
(Warm-up control), or leave it on and watch it happen with `setLogLevel(PromptSurge.LogLevel.INFO)`.

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

## What the two buttons do, and the policy line you must not cross

The pre-prompt asks first, and **only the confirm button opens the native review flow.** Tapping
the dismiss button records a cooldown, fires a `pre_prompt_dismissed` event, and does not launch
Play's in-app review. That is a deliberate product choice: a user who says "not now" is answering
the question, and we do not hand them the rating sheet anyway.

**This makes your copy the thing that carries the policy risk, so read this before you edit it.**
The default copy is a plain call to action ("Leave a review?"). If you rewrite the four strings
into a satisfaction question - "Are you enjoying the app?", "How are we doing?" - then the dialog
stops being an ask and becomes a filter that routes only happy users to the store. That is the
pattern Apple App Store rule 5.6.1 and Google Play's in-app review policy are about, and the
consequence lands on your app's listing, not ours.

Keep the copy a request to review. Do not make it a question about how the user feels.

---

## API reference

| Method | Description |
|--------|-------------|
| `PromptSurge.initialize(context, apiKey)` | Initialize the SDK. Call once. A blank key is rejected with a logged error and leaves the SDK uninitialized. |
| `PromptSurge.initialize(context, apiKey, verifyToken)` | Same, plus the one-shot app-ownership token from the dashboard's Verify page. It rides along with the next event batch; remove it once the dashboard shows the app as verified. |
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

Alongside it, each event records which prompt step happened (`pre_prompt_shown`,
`pre_prompt_confirmed`, `pre_prompt_dismissed`, `native_prompt_requested`, `initialize`,
`first_open`), your app version, the SDK version, and the device locale. Nothing else. No
advertising identifier is used anywhere.

## Play Data Safety: what to declare

You have to answer this questionnaire yourself, and the enforcement lands on you rather than on
us, so here are the answers for what this SDK does. Declare these **in addition to** whatever the
rest of your app collects.

| Data type | Collected | Shared | Purpose | Linked to user | Optional |
| --- | --- | --- | --- | --- | --- |
| Device or other IDs | Yes | No | Analytics | **No** | No, required for the feature |
| App activity &rsaquo; App interactions | Yes | No | Analytics | **No** | No, required for the feature |

Notes that matter for the form:

- **"Shared" is No.** The data goes to PromptSurge as your processor to run the feature you
  integrated. It is not passed on to anyone else. Google's definition of sharing is transfer to a
  *third party*, and a service provider acting on your instructions is not one.
- **"Linked to the user" is No.** The identifier is a salted hash with no account, email, or
  advertising ID attached to it.
- **Encrypted in transit: Yes.** Every request is HTTPS.
- **Data deletion:** contact PromptSurge; there is no in-app deletion flow to declare.
- The SDK requests **no runtime permissions** and adds none to your manifest.
