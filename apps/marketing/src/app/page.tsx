import { ADMIN_URL } from '@/lib/constants';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Problem />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <FinalCTA />
    </main>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-teal-900 py-20 sm:py-32">
      {/* Subtle background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-brand-100 backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          Free during beta
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          The AI app marketing<br className="hidden sm:block" /> growth engine
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100 sm:text-xl">
          PromptSurge generates Apple-compliant, AI-crafted review prompts tailored to your app&apos;s
          best features. Install in one day. Watch your ratings climb.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href={`${ADMIN_URL}/signup`}
            className="w-full rounded-xl bg-white px-8 py-4 text-center text-base font-semibold text-brand-700 shadow-lg hover:bg-brand-50 transition-colors sm:w-auto"
          >
            Start for free →
          </a>
          <a
            href="/docs"
            className="w-full rounded-xl border border-white/30 px-8 py-4 text-center text-base font-medium text-white hover:bg-white/10 transition-colors sm:w-auto"
          >
            View integration docs
          </a>
        </div>

        <p className="mt-6 text-sm text-brand-200">
          No credit card required · 1-day Android integration · Apple 5.6.1 compliant
        </p>

        {/* Social proof logos */}
        <div className="mt-14 border-t border-white/20 pt-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-300 mb-6">
            Built for mobile teams shipping on
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-70">
            <AndroidBadge />
            <IosBadge />
          </div>
        </div>
      </div>
    </section>
  );
}

function AndroidBadge() {
  return (
    <div className="flex items-center gap-2 text-white">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.523 15.341a.79.79 0 01-.789.789.79.79 0 01-.79-.789V10.3a.79.79 0 01.79-.79.79.79 0 01.789.79v5.041zm-10.256 0a.79.79 0 01-.789.789.79.79 0 01-.79-.789V10.3a.79.79 0 01.79-.79.79.79 0 01.789.79v5.041zM6.963 7.498l-1.12-2.057a.232.232 0 01.095-.315.233.233 0 01.315.096l1.133 2.08A6.957 6.957 0 0112 6.5c1.378 0 2.665.397 3.748 1.083l1.133-2.08a.233.233 0 01.315-.096.232.232 0 01.095.315l-1.12 2.057A6.964 6.964 0 0119 13.5H5a6.964 6.964 0 011.963-6.002zM9.5 11a.5.5 0 100-1 .5.5 0 000 1zm5 0a.5.5 0 100-1 .5.5 0 000 1z" />
      </svg>
      <span className="font-medium text-sm">Google Play</span>
    </div>
  );
}

function IosBadge() {
  return (
    <div className="flex items-center gap-2 text-white">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      <span className="font-medium text-sm">App Store</span>
    </div>
  );
}

// ─── Problem ──────────────────────────────────────────────────────────────────

function Problem() {
  return (
    <section className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Getting reviews is broken
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Most apps ask at the wrong time, with generic text, and get buried.
            The result: your best users never leave a review, and your worst ones do.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {[
            {
              icon: '⏰',
              title: 'Wrong timing',
              body: 'Showing the prompt before the user achieves a win kills your rating. Timing is everything — and most apps get it wrong.',
            },
            {
              icon: '📝',
              title: 'Generic copy',
              body: '"Enjoying the app? Rate us!" converts poorly. Users respond to prompts that speak to what they actually value.',
            },
            {
              icon: '📉',
              title: 'No feedback loop',
              body: 'You have no visibility into how many users saw the prompt, tapped through, or left a review.',
            },
          ].map(item => (
            <div key={item.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <div className="text-3xl mb-4">{item.icon}</div>
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            From zero to reviews in one day
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Three steps. No servers to manage. No review-gating.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Install the SDK',
              body: 'Add one line to your Gradle dependencies. Initialize with your API key. The SDK handles timing, cooldowns, and Apple 5.6.1 compliance automatically.',
              detail: '1-line Gradle dependency · < 50 KB · Android now, iOS coming soon',
            },
            {
              step: '02',
              title: 'Customize your prompts',
              body: 'Paste your app reviews — the AI extracts your most-praised features and generates review prompts that highlight them. Accept, edit, or write your own.',
              detail: 'AI-generated copy · Multi-locale · Works with any LLM provider',
            },
            {
              step: '03',
              title: 'Watch ratings grow',
              body: 'The dashboard shows impressions, tap-through rates, and reviews-per-install over time. See exactly which prompts drive the most action.',
              detail: 'Real-time metrics · CSV export · Per-locale and per-version breakdown',
            },
          ].map(item => (
            <div key={item.step} className="relative">
              <div className="text-6xl font-black text-brand-100 leading-none mb-4">{item.step}</div>
              <h3 className="text-xl font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-3 text-gray-600">{item.body}</p>
              <p className="mt-3 text-xs font-medium text-brand-600">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <a
            href={`${ADMIN_URL}/signup`}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-4 text-white font-semibold hover:bg-brand-700 transition-colors"
          >
            Start integrating →
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Free while we&apos;re in beta
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          Full access, no credit card, no time limit. We&apos;ll give you at least 30 days notice before introducing paid tiers.
        </p>

        <div className="mt-12 rounded-2xl border-2 border-brand-600 bg-white p-8 shadow-lg text-left">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">Beta access</p>
              <p className="mt-1 text-gray-500">Everything included, forever free for early adopters</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-brand-600">$0</p>
              <p className="text-sm text-gray-400">/ month</p>
            </div>
          </div>

          <ul className="mt-8 space-y-3">
            {[
              'Unlimited apps',
              'Unlimited prompt impressions',
              'AI prompt generation (bring your own LLM key)',
              'Review theme extraction from paste',
              'Full metrics dashboard (impressions, tap-through, GEO)',
              'Multi-locale prompt texts',
              'CSV exports',
              'Android SDK (iOS coming soon)',
            ].map(feature => (
              <li key={feature} className="flex items-center gap-3 text-gray-700">
                <span className="text-brand-500 flex-shrink-0">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          <a
            href={`${ADMIN_URL}/signup`}
            className="mt-8 block rounded-xl bg-brand-600 px-6 py-3.5 text-center font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            Create a free account →
          </a>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Questions about pricing?{' '}
          <a href="mailto:hello@promptsurge.me" className="text-brand-600 hover:underline">
            hello@promptsurge.me
          </a>
        </p>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'Is this compliant with Apple App Store guidelines?',
    a: 'Yes. PromptSurge only triggers the native SKStoreReviewController (or Google\'s in-app review API on Android). We never show a custom rating UI or gate the native prompt on a pre-screening sentiment question — both of which violate Apple 5.6.1. The pre-prompt is purely a soft ask ("Would you mind leaving a quick review?") with no routing based on expected sentiment.',
  },
  {
    q: 'How long does integration take?',
    a: 'For Android: add one line to build.gradle, initialize with your API key, and place one trigger call. Most developers are live in under a day. There is no backend to deploy — the SDK talks directly to our API.',
  },
  {
    q: 'Do I need to provide an LLM API key?',
    a: 'Yes — PromptSurge is bring-your-own-LLM. We support OpenAI, Anthropic, Gemini, and any OpenAI-compatible endpoint (including DeepSeek). You paste your key once in the dashboard; it\'s encrypted at rest and never returned in API responses. We never hold your LLM costs.',
  },
  {
    q: 'What data does the SDK send to your servers?',
    a: 'The SDK sends anonymised usage events: a hashed device ID (SHA-256 of Android ID + package name — no raw PII), app version, locale, and event type (shown, confirmed, dismissed). No email, no name, no location beyond the device locale. Full details in our Privacy Policy.',
  },
  {
    q: 'Can users opt out?',
    a: 'Yes. Call PromptSurge.optOut() to permanently suppress all SDK activity for that device. You should surface this in your app\'s privacy controls. The SDK respects the flag immediately and persists it across restarts.',
  },
  {
    q: 'How does the AI generate prompt copy?',
    a: 'You paste your app store reviews into the dashboard. The AI (using your own LLM key) extracts recurring praise themes — e.g. "graphics", "offline mode", "fast sync" — and generates review prompts that naturally reference those themes. You review and accept the ones you want. The pasted review text is processed in memory and never stored.',
  },
  {
    q: 'What happens after the beta ends?',
    a: 'We will give at least 30 days notice before any pricing changes. Early adopters who provide feedback during beta will receive preferred pricing. We are not planning to remove the free tier — only to add paid tiers with higher limits for larger teams.',
  },
];

function FAQ() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Frequently asked questions
        </h2>

        <dl className="mt-12 space-y-6">
          {FAQS.map(item => (
            <details
              key={item.q}
              className="group rounded-xl border border-gray-200 bg-white px-6 py-5 open:shadow-sm transition-shadow"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-gray-900 list-none">
                {item.q}
                <span className="flex-shrink-0 text-brand-600 text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-gray-600 text-sm leading-relaxed">{item.a}</p>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="bg-gradient-to-br from-brand-600 to-teal-800 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Your next 100 reviews start here
        </h2>
        <p className="mt-4 text-lg text-brand-100">
          Set up in a day. No credit card required. Apple-compliant out of the box.
        </p>
        <a
          href={`${ADMIN_URL}/signup`}
          className="mt-10 inline-flex items-center gap-2 rounded-xl bg-white px-10 py-4 font-semibold text-brand-700 shadow-lg hover:bg-brand-50 transition-colors text-lg"
        >
          Create your free account →
        </a>
        <p className="mt-4 text-sm text-brand-200">
          Already have an account?{' '}
          <a href={`${ADMIN_URL}/login`} className="underline hover:text-white">
            Log in
          </a>
        </p>
      </div>
    </section>
  );
}
