# Changelog - PromptSurge Android SDK

The version is `VERSION_NAME` in `gradle.properties` (it feeds `BuildConfig.SDK_VERSION` and the
Maven coordinate). CI tags the public mirror (`PromptSurge-SDK/sdk-android`) with it when it
changes; tags are never moved.

## 1.3.0 - 2026-11-16

### Added

- **"Announce only" pre-prompt (card 833).** The SDK now tells the server it can draw a one-button
  notice (`notice=1` on `/v1/prompts`). When the app is set to "Announce only" in the PromptSurge
  console, the server answers `mode: "notice"` and the dialog shows ONE button (`ctaConfirm`); the
  button, back and a tap outside all lead to Play's review flow, and no `pre_prompt_dismissed` is
  sent. Apps left on the default "Ask first" see no change. The store-limit guard still decides
  first: when Play would likely show nothing, there is no notice either.
- **`native_sheet_closed { awayMs, source }`.** Play completes its review flow the same way
  whether the card appeared, was rated or was closed, so the SDK reports how long the flow took
  (`launchReviewFlow` until completion). A second or more means the card was on screen. Sent on
  every path that asks Play (confirm, notice, warm-up, holdout, impression limit).

## 1.2.0 - 2026-10-19


### Changed

- **The bundled default copy is a statement.** Title "A quick favor", body "A short review helps
  other people discover apps like this.", buttons "Sure" / "Not now" - identical on Android, iOS,
  Unity and the server's own fallback. It was "Leave a review?" / "Reviews help other people
  discover apps like this. Got a moment?". Google's in-app review guidance says an app should not
  ask the user any questions before or while presenting the rating button or card, and the old
  title was one; the no-satisfaction-question rule is unchanged. The default only shows when there
  is no cached server copy and the fetch fails; dashboard copy replaces it.
- **Log lines use a plain hyphen where they had an em dash**, for example
  `requestReview() called before initialize() - ignoring.` If you match SDK log text anywhere,
  update the pattern. A failed review-flow request now always names its path, e.g.
  `requestReviewFlow (confirm) failed: ...`.

### Added

- **Play review quota.** Google does not publish it; its guide says calling the flow more than
  once within a short period (for example, less than a month) may not show a dialog, and Play never
  says whether it showed one. The SDK now records every review flow it requests - the confirm path,
  warm-up, the impression limit and holdout - in `SharedPreferences` (`ps_rate_limiter`,
  `native_review_requests`, last 5 entries), and **within 30 days of one** a `requestReview()` call
  shows **no pre-prompt and requests no review flow**. No impression is recorded; one INFO line
  names the date the next request becomes possible.
  - Holdout and warm-up devices are held to the same rule, so both sides of the lift comparison
    skip under the same condition.
  - Today the 90-day cooldown already spaces this SDK's requests more than 30 days apart, so on
    Android the check is a floor under that rule, not a new limit.
  - No new telemetry event: a skipped call sends nothing, and `POST /v1/events` accepts only the
    six existing event types.
  - `clearRateLimitForTesting()` clears the record along with the cooldowns.

### Also unreleased since 1.1.0

- Card 349: the SDK adopts the holdout group the server remembers for this device (from the
  `POST /v1/events` response), from the next session on. In the source since 2026-09-14, in no tag.

### Upgrade notes

- The request record starts empty on upgrade; requests made by 1.1.0 and earlier are not counted.
  The 90-day cooldown, which earlier versions did record, still applies.
- The record cannot see review flows the host app launches itself.
