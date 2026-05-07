import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getApp } from '@/lib/api';
import { getSessionToken } from '@/lib/session';
import { CopyButton } from './CopyButton';

export const dynamic = 'force-dynamic';

// ─── Reusable primitives ──────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="relative pl-10">
      {/* Step circle */}
      <div
        className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ background: 'var(--color-brand)' }}
      >
        {n}
      </div>
      {/* Connector line (not on last step — handled by CSS :last-child) */}
      <div
        className="absolute left-3.5 top-7 bottom-0 w-px"
        style={{ background: 'var(--ink-10)' }}
        aria-hidden
      />
      <h2
        className="mb-3 text-base font-semibold"
        style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
      >
        {title}
      </h2>
      <div className="mb-10">{children}</div>
    </section>
  );
}

function CodeBlock({ code, language = 'kotlin' }: { code: string; language?: string }) {
  return (
    <div
      className="group relative overflow-hidden rounded-lg"
      style={{ background: '#0F1117', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Language badge + copy */}
      <div
        className="flex items-center justify-between border-b px-4 py-2"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <span className="text-[11px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {language}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto px-5 py-4 text-sm leading-relaxed" style={{ color: '#E2E8F0', fontFamily: 'var(--font-space-mono), ui-monospace, monospace' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Callout({ type, children }: { type: 'info' | 'warning'; children: React.ReactNode }) {
  const styles =
    type === 'info'
      ? { bg: 'var(--teal-50)', border: 'var(--teal-200)', iconColor: 'var(--teal-500)', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
      : { bg: '#FFFBEB', border: '#FDE68A', iconColor: '#D97706', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' };

  return (
    <div
      className="flex gap-3 rounded-lg px-4 py-3 text-sm"
      style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
    >
      <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke={styles.iconColor} strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={styles.icon} />
      </svg>
      <div style={{ color: 'var(--ink)' }}>{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InstallPage({ params }: { params: { id: string } }) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let app: Awaited<ReturnType<typeof getApp>>;
  try {
    app = await getApp(token, params.id);
  } catch (e: unknown) {
    const status = (e as { status?: number }).status;
    if (status === 404) notFound();
    redirect('/login');
  }

  const activeKey = app.activeKeys.find((k) => !k.revokedAt);
  // We can't show the full key (not stored in plaintext), so show a placeholder
  // with the suffix so they can confirm they're using the right key.
  const keySuffix = activeKey ? activeKey.id.slice(-6) : 'xxxxxx';
  const apiKeyPlaceholder = activeKey ? `ps_live_YOUR_KEY_…${keySuffix}` : 'ps_live_YOUR_API_KEY';

  // ─── Code snippets ──────────────────────────────────────────────────────────

  const gradleSettingsCode = `// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}`;

  const gradleDependencyCode = `// app/build.gradle.kts
dependencies {
    implementation("com.github.promptsurge:sdk-android:0.1.0")
}`;

  const manifestCode = `<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />`;

  const initCode = `// MyApplication.kt
import android.app.Application
import com.promptsurge.sdk.PromptSurge

class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        PromptSurge.initialize(
            context = this,
            apiKey  = "${apiKeyPlaceholder}"
        )
    }
}`;

  const manifestAppCode = `<!-- AndroidManifest.xml — register your Application class -->
<application
    android:name=".MyApplication"
    ...>`;

  const usageCode = `// In your Activity or Fragment — call at a high-satisfaction moment
// e.g. after a successful purchase, level completion, etc.
import com.promptsurge.sdk.PromptSurge

class MainActivity : FragmentActivity() {

    private fun onUserReachedMilestone() {
        // PromptSurge shows the pre-prompt dialog, then launches
        // the Play In-App Review flow if the user confirms.
        PromptSurge.requestReview(activity = this)
    }
}`;

  const debugCode = `// During development — reset the rate-limit so you can test repeatedly
PromptSurge.clearRateLimitForTesting()
PromptSurge.requestReview(activity = this)`;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="mb-1 text-xl font-semibold"
          style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
        >
          SDK Installation
        </h1>
        <p className="text-sm" style={{ color: 'var(--ink-60)' }}>
          Add PromptSurge to your Android app in four steps.
        </p>
        {!activeKey && (
          <div className="mt-3">
            <Callout type="warning">
              This app has no active API key.{' '}
              <Link href={`/apps/${params.id}`} className="font-medium underline">
                Go to Overview
              </Link>{' '}
              to rotate one before installing.
            </Callout>
          </div>
        )}
      </div>

      {/* Steps */}
      <div>
        {/* Step 1 */}
        <Step n={1} title="Add the repository and dependency">
          <p className="mb-3 text-sm" style={{ color: 'var(--ink-60)' }}>
            The SDK is distributed via JitPack. Add it to your Gradle settings file, then declare
            the dependency in your app module.
          </p>
          <div className="space-y-3">
            <CodeBlock code={gradleSettingsCode} language="gradle" />
            <CodeBlock code={gradleDependencyCode} language="gradle" />
          </div>
          <div className="mt-3">
            <Callout type="info">
              The SDK requires <strong>minSdk 24</strong> (Android 7.0) and uses the{' '}
              <strong>Play In-App Review API</strong> — make sure your app is distributed via
              Google Play.
            </Callout>
          </div>
        </Step>

        {/* Step 2 */}
        <Step n={2} title="Declare the INTERNET permission">
          <p className="mb-3 text-sm" style={{ color: 'var(--ink-60)' }}>
            The SDK sends events to the PromptSurge API. Add this to your manifest if it isn't
            already there.
          </p>
          <CodeBlock code={manifestCode} language="xml" />
        </Step>

        {/* Step 3 */}
        <Step n={3} title="Initialize in Application.onCreate">
          <p className="mb-3 text-sm" style={{ color: 'var(--ink-60)' }}>
            Create a custom{' '}
            <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--ink-10)' }}>
              Application
            </code>{' '}
            class (or use your existing one) and call{' '}
            <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--ink-10)' }}>
              PromptSurge.initialize()
            </code>{' '}
            once. Replace the placeholder with your full API key from the{' '}
            <Link href={`/apps/${params.id}`} className="font-medium" style={{ color: 'var(--color-brand)' }}>
              Overview page
            </Link>{' '}
            key reveal dialog.
          </p>
          <div className="space-y-3">
            <CodeBlock code={initCode} language="kotlin" />
            <CodeBlock code={manifestAppCode} language="xml" />
          </div>
          {activeKey && (
            <div className="mt-3">
              <Callout type="info">
                Your active key ends in{' '}
                <code
                  className="rounded px-1 py-0.5 text-xs font-medium"
                  style={{ background: 'var(--teal-50)', color: 'var(--teal-600)' }}
                >
                  …{keySuffix}
                </code>
                . Copy the full key from the Overview page key card — it is only displayed once
                when created or rotated.
              </Callout>
            </div>
          )}
        </Step>

        {/* Step 4 */}
        <Step n={4} title="Trigger the review dialog">
          <p className="mb-3 text-sm" style={{ color: 'var(--ink-60)' }}>
            Call{' '}
            <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--ink-10)' }}>
              requestReview()
            </code>{' '}
            at a natural high-satisfaction moment — after a successful purchase, completing a task,
            or reaching a milestone. The SDK handles rate-limiting automatically (max once every 90
            days per device).
          </p>
          <div className="space-y-3">
            <CodeBlock code={usageCode} language="kotlin" />
          </div>
          <div className="mt-3">
            <Callout type="info">
              During development the Play In-App Review sheet won't appear on sideloaded builds —
              this is enforced by Google Play. Use the helper below to reset rate limits and verify
              your dialog copy appears correctly.
            </Callout>
          </div>
          <div className="mt-3">
            <CodeBlock code={debugCode} language="kotlin" />
          </div>
        </Step>
      </div>

      {/* Verify section — no step circle, just a card */}
      <div
        className="mt-2 rounded-xl p-5"
        style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}
      >
        <div className="flex items-start gap-3">
          <svg
            className="mt-0.5 h-5 w-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="var(--teal-500)"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="font-semibold" style={{ color: 'var(--teal-700)' }}>
              Verify it's working
            </p>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--teal-600)' }}>
              After your first{' '}
              <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--teal-100)' }}>
                initialize()
              </code>{' '}
              call the SDK fires an{' '}
              <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--teal-100)' }}>
                sdk_initialized
              </code>{' '}
              event. Check the{' '}
              <Link
                href={`/apps/${params.id}/events`}
                className="font-medium underline"
                style={{ color: 'var(--teal-700)' }}
              >
                Events page
              </Link>{' '}
              to confirm events are arriving.
            </p>
          </div>
        </div>
      </div>

      {/* Spacer at bottom so the last step line doesn't overflow */}
      <div className="h-8" />
    </div>
  );
}
