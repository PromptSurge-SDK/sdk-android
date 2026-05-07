import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Docs — PromptSurge',
  description: 'Integration quickstart for the PromptSurge Android SDK.',
};

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <nav className="mb-8 text-sm text-gray-500">
        <a href="/" className="hover:text-brand-700">Home</a>
        <span className="mx-2">/</span>
        <span>Docs</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900">Integration quickstart</h1>
      <p className="mt-3 text-gray-600">Get PromptSurge running in your Android app in under a day.</p>

      <nav className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">On this page</p>
        <ul className="space-y-1 text-sm text-brand-700">
          <li><a href="#prerequisites" className="hover:underline">Prerequisites</a></li>
          <li><a href="#install" className="hover:underline">1. Install the SDK</a></li>
          <li><a href="#initialize" className="hover:underline">2. Initialize</a></li>
          <li><a href="#trigger" className="hover:underline">3. Trigger a prompt</a></li>
          <li><a href="#opt-out" className="hover:underline">4. Opt-out support</a></li>
          <li><a href="#api-reference" className="hover:underline">API reference</a></li>
          <li><a href="#compliance" className="hover:underline">Apple / Google compliance</a></li>
        </ul>
      </nav>

      <div className="prose prose-gray mt-12 max-w-none prose-headings:scroll-mt-20 prose-code:bg-gray-100 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-brand-700 prose-code:before:content-none prose-code:after:content-none">

        <h2 id="prerequisites">Prerequisites</h2>
        <ul>
          <li>Android API level 21+</li>
          <li>A PromptSurge account — <a href="https://admin.promptsurge.me/signup" className="text-brand-600 hover:underline">sign up free</a></li>
          <li>An API key from the <a href="https://admin.promptsurge.me" className="text-brand-600 hover:underline">admin panel</a></li>
        </ul>

        <h2 id="install">1. Install the SDK</h2>
        <p>Add the dependency to your app&apos;s <code>build.gradle</code>:</p>

        <CodeBlock language="groovy">{`dependencies {
    implementation 'me.promptsurge:sdk-android:1.0.0'
}`}</CodeBlock>

        <p>Or with Kotlin DSL (<code>build.gradle.kts</code>):</p>

        <CodeBlock language="kotlin">{`dependencies {
    implementation("me.promptsurge:sdk-android:1.0.0")
}`}</CodeBlock>

        <p>Sync Gradle. No additional permissions are required in <code>AndroidManifest.xml</code>.</p>

        <h2 id="initialize">2. Initialize</h2>
        <p>Initialize once, early in your <code>Application.onCreate()</code>:</p>

        <CodeBlock language="kotlin">{`import me.promptsurge.sdk.PromptSurge

class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        PromptSurge.initialize(
            context = this,
            apiKey = "ps_live_your_key_here",
            // Optional: override the API endpoint (default: https://api.promptsurge.me)
            // apiUrl = "https://api.promptsurge.me"
        )
    }
}`}</CodeBlock>

        <p>Store your API key in <code>local.properties</code> or use <code>BuildConfig</code> — never commit it to source control.</p>

        <h2 id="trigger">3. Trigger a prompt</h2>
        <p>Call <code>showPrePromptIfEligible()</code> at a natural win moment — after a user completes a level, finishes an import, or achieves a milestone:</p>

        <CodeBlock language="kotlin">{`// In an Activity or Fragment
PromptSurge.showPrePromptIfEligible(activity = this)

// Or from a ViewModel (pass the Activity reference)
PromptSurge.showPrePromptIfEligible(activity = requireActivity())`}</CodeBlock>

        <p>
          The SDK handles all eligibility checks automatically:
        </p>
        <ul>
          <li><strong>90-day cooldown</strong> after the pre-prompt is shown</li>
          <li><strong>7-day cooldown</strong> after a dismiss</li>
          <li>Skips if the user has already submitted a review recently</li>
          <li>Respects Google Play&apos;s in-app review quota</li>
        </ul>

        <h2 id="opt-out">4. Opt-out support</h2>
        <p>Expose an opt-out option in your privacy settings:</p>

        <CodeBlock language="kotlin">{`// Opt the user out — persists across restarts, stops all SDK activity
PromptSurge.optOut()

// Check current status
val isOptedOut = PromptSurge.isOptedOut()

// Re-enable (if user changes their mind)
PromptSurge.optIn()`}</CodeBlock>

        <h2 id="api-reference">API reference</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-4 font-semibold text-gray-700">Method</th>
              <th className="text-left py-2 font-semibold text-gray-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['initialize(context, apiKey)', 'Initialize the SDK. Call once in Application.onCreate().'],
              ['showPrePromptIfEligible(activity)', 'Show the pre-prompt if eligibility checks pass.'],
              ['optOut()', 'Permanently suppress all SDK activity for this device.'],
              ['optIn()', 'Re-enable SDK activity (if user opts back in).'],
              ['isOptedOut()', 'Returns true if the user has opted out.'],
            ].map(([method, desc]) => (
              <tr key={method as string}>
                <td className="py-2 pr-4 font-mono text-xs text-brand-700">{method}</td>
                <td className="py-2 text-gray-600">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 id="compliance">Apple / Google compliance</h2>
        <p>PromptSurge is designed from the ground up to comply with both Apple App Store Review Guideline 5.6.1 and Google Play&apos;s in-app review policy:</p>
        <ul>
          <li>The pre-prompt is a simple soft ask — it does <strong>not</strong> route users based on expected sentiment</li>
          <li>Confirming triggers the native <code>SKStoreReviewController</code> (iOS) or Google&apos;s <code>ReviewManager</code> (Android) — never a custom rating UI</li>
          <li>Rate limits and cooldowns are enforced client-side to respect platform quotas</li>
          <li>No personal data is collected beyond a hashed device ID and locale</li>
        </ul>

        <hr className="my-10" />

        <div className="rounded-xl bg-brand-50 border border-brand-200 p-5">
          <p className="font-semibold text-brand-800">Need help?</p>
          <p className="mt-1 text-sm text-brand-700">
            Email us at{' '}
            <a href="mailto:hello@promptsurge.me" className="underline">hello@promptsurge.me</a>
            {' '}or open the dashboard to manage your prompts and view metrics.
          </p>
          <a
            href="https://admin.promptsurge.me"
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Open dashboard →
          </a>
        </div>
      </div>
    </main>
  );
}

function CodeBlock({ children, language }: { children: string; language: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-gray-900 p-5 text-sm leading-relaxed">
      <code className={`language-${language} text-gray-100`}>{children}</code>
    </pre>
  );
}
