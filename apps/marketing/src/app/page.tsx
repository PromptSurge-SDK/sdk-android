import { ADMIN_URL } from '@/lib/constants';
import { SurgeMark } from '@/components/SurgeMark';

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
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0B8068] via-[#0d9488] to-[#134e4a] py-20 sm:py-32">
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        {/* Beta badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-teal-100 backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          Free during beta
        </div>

        {/* Logo mark in hero */}
        <div className="mb-8 flex justify-center">
          <SurgeMark size="hero" />
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl" style={{ letterSpacing: '-0.03em' }}>
          The review growth engine<br className="hidden sm:block" /> for mobile apps
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-teal-100 sm:text-xl">
          PromptSurge shows a perfectly-timed, AI-crafted pre-prompt before the native rating
          sheet. Install in one day. Watch your store ratings climb.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href={`${ADMIN_URL}/signup`}
            className="w-full rounded-xl bg-white px-8 py-4 text-center text-base font-semibold text-brand-700 shadow-lg hover:bg-teal-50 transition-colors sm:w-auto"
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

        <p className="mt-6 text-sm text-teal-200">
          No credit card required · 1-day Android integration · Apple App Store guideline 5.6.1 compliant
        </p>

        {/* Platform badges */}
        <div className="mt-14 border-t border-white/20 pt-10">
          <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-teal-300">
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
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.523 15.341a.79.79 0 01-.789.789.79.79 0 01-.79-.789V10.3a.79.79 0 01.79-.79.79.79 0 01.789.79v5.041zm-10.256 0a.79.79 0 01-.789.789.79.79 0 01-.79-.789V10.3a.79.79 0 01.79-.79.79.79 0 01.789.79v5.041zM6.963 7.498l-1.12-2.057a.232.232 0 01.095-.315.233.233 0 01.315.096l1.133 2.08A6.957 6.957 0 0112 6.5c1.378 0 2.665.397 3.748 1.083l1.133-2.08a.233.233 0 01.315-.096.232.232 0 01.095.315l-1.12 2.057A6.964 6.964 0 0119 13.5H5a6.964 6.964 0 011.963-6.002zM9.5 11a.5.5 0 100-1 .5.5 0 000 1zm5 0a.5.5 0 100-1 .5.5 0 000 1z" />
      </svg>
      <span className="font-medium text-sm">Google Play</span>
    </div>
  );
}

function IosBadge() {
  return (
    <div className="flex items-center gap-2 text-white">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl" style={{ letterSpacing: '-0.025em' }}>
            Getting reviews is broken
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Most apps ask at the wrong time, with generic text, and get buried.
            Your best users never leave a review — your worst ones do.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {[
            {
              icon: '⏰',
              title: 'Wrong timing',
              body: 'Showing the prompt before the user achieves a win tanks your rating. Timing is everything — and most apps get it wrong.',
            },
            {
              icon: '📝',
              title: 'Generic copy',
              body: '"Enjoying the app? Rate us!" converts poorly. Users respond to prompts that speak to what they actually value in your app.',
            },
            {
              icon: '📉',
              title: 'No feedback loop',
              body: "You have no visibility into how many users saw the prompt, tapped through, or left a review. You're flying blind.",
            },
          ].map(item => (
            <div key={item.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <div className="mb-4 text-3xl">{item.icon}</div>
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
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl" style={{ letterSpacing: '-0.025em' }}>
            From zero to reviews in one day
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Three steps. No servers to manage. No review-gating.
          </p>
        </div>

        <div className="mt-16 grid gap-10 sm:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Install the SDK',
              body: 'Add one line to your Gradle dependencies and initialize with your API key. Cooldowns, Apple 5.6.1 compliance, and opt-out handling are automatic.',
              detail: '1-line Gradle dependency · < 50 KB · Android now, iOS coming soon',
            },
            {
              step: '02',
              title: 'Generate AI prompts',
              body: 'Paste your existing reviews — the AI (your own LLM key) extracts recurring praise themes and writes pre-prompts that mention them by name.',
              detail: 'OpenAI · Anthropic · Gemini · any OpenAI-compatible endpoint',
            },
            {
              step: '03',
              title: 'Watch ratings grow',
              body: 'The dashboard shows impressions, tap-through rates, and per-locale breakdowns in real time. See exactly which prompts convert.',
              detail: 'Real-time metrics · CSV export · per-locale & per-version breakdown',
            },
          ].map(item => (
            <div key={item.step} className="relative">
              <div className="mb-4 text-6xl font-black leading-none text-brand-100">{item.step}</div>
              <h3 className="text-xl font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-3 text-gray-600">{item.body}</p>
              <p className="mt-3 text-xs font-medium text-brand-600">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <a
            href={`${ADMIN_URL}/signup`}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-4 font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            Start integrating →
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const CHECK = (
  <svg className="h-4 w-4 flex-shrink-0 text-brand-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

function Pricing() {
  return (
    <section id="pricing" className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl" style={{ letterSpacing: '-0.025em' }}>
            Free while we&apos;re in beta
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            Full access, no credit card, no time limit. After beta, plans scale with your impression volume.
          </p>
        </div>

        {/* Current: Beta card */}
        <div className="mt-12 rounded-2xl border-2 border-brand-600 bg-white p-8 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
                Current — beta
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">Full access</p>
              <p className="mt-1 text-gray-500">Everything included, completely free for early adopters</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-brand-600">$0</p>
              <p className="text-sm text-gray-400">/ month</p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {[
              {
                category: 'SDK & ingestion',
                items: [
                  'Android SDK (iOS coming soon)',
                  'Unlimited prompt impressions',
                  'Unlimited event ingestion',
                  'Apple guideline 5.6.1 compliant',
                  'Device-level opt-out API',
                ],
              },
              {
                category: 'AI & prompts',
                items: [
                  'AI prompt generation (bring your own LLM key)',
                  'OpenAI, Anthropic, Gemini support',
                  'Review theme extraction from paste',
                  'Multi-locale prompt texts',
                  'Up to 10 theme analyses / day / app',
                ],
              },
              {
                category: 'Analytics',
                items: [
                  'Real-time metrics dashboard',
                  'Tap-through rate tracking',
                  'GEO breakdown (top 20 locales)',
                  'Per-version breakdown',
                  'CSV export for all charts',
                ],
              },
              {
                category: 'Platform',
                items: [
                  'Unlimited apps',
                  'Unlimited team members per app',
                  'API key rotation',
                  'LLM cost logging',
                  'Email support',
                ],
              },
            ].map(group => (
              <div key={group.category}>
                <p className="mb-3 text-sm font-semibold text-gray-700">{group.category}</p>
                <ul className="space-y-2">
                  {group.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                      {CHECK}
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <a
            href={`${ADMIN_URL}/signup`}
            className="mt-10 block rounded-xl bg-brand-600 px-6 py-4 text-center text-lg font-semibold text-white hover:bg-brand-700 transition-colors"
          >
            Create a free account →
          </a>
        </div>

        {/* Upcoming tiers — teaser */}
        <div className="mt-10">
          <p className="mb-4 text-center text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Upcoming paid tiers (post-beta)
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { name: 'Indie',      impressions: '2,500 / mo',   note: 'Free forever',      highlight: false },
              { name: 'Startup',    impressions: '30,000 / mo',  note: 'Pricing TBD',        highlight: false },
              { name: 'Growth',     impressions: '250,000 / mo', note: 'Pricing TBD',        highlight: false },
            ].map(tier => (
              <div
                key={tier.name}
                className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-center"
              >
                <p className="font-semibold text-gray-900">{tier.name}</p>
                <p className="mt-1 text-2xl font-bold text-brand-600">{tier.impressions}</p>
                <p className="mt-1 text-xs text-gray-400">{tier.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            Enterprise (unlimited) available on request ·{' '}
            <a href="mailto:hello@promptsurge.me" className="text-brand-600 hover:underline">
              hello@promptsurge.me
            </a>
          </p>
        </div>

        {/* Guarantee */}
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="font-semibold text-gray-900">Our beta promise</p>
          <p className="mt-1 text-sm text-gray-600">
            We&apos;ll give at least <strong>30 days notice</strong> before any paid tiers go live.
            Early adopters who provide feedback will receive preferred pricing.
            We are not planning to remove a free tier.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'Is this compliant with Apple App Store guidelines?',
    a: 'Yes. PromptSurge only triggers the native SKStoreReviewController (or Google\'s in-app review API on Android). We never show a custom rating UI or gate the native prompt on a pre-screening sentiment question — both of which violate guideline 5.6.1. The pre-prompt is purely a soft ask ("Would you mind leaving a quick review?") with no routing based on expected sentiment.',
  },
  {
    q: 'How long does integration take?',
    a: 'For Android: add one line to build.gradle, initialize with your API key, and place one trigger call. Most developers are live in under a day. There is no backend to deploy — the SDK talks directly to our API.',
  },
  {
    q: 'Do I need to provide an LLM API key?',
    a: 'Yes — PromptSurge is bring-your-own-LLM. We support OpenAI, Anthropic, Gemini, and any OpenAI-compatible endpoint (including DeepSeek, Mistral, etc.). You enter your key once in the dashboard; it\'s encrypted at rest and never returned in API responses.',
  },
  {
    q: 'What data does the SDK collect?',
    a: 'The SDK sends anonymised usage events: a hashed device ID (SHA-256 of Android ID + package name — no raw PII), app version, locale, and event type (shown, confirmed, dismissed). No email, name, or precise location. Full details in our Privacy Policy.',
  },
  {
    q: 'Can users opt out?',
    a: 'Yes. Call PromptSurge.optOut() to permanently suppress all SDK activity on that device. You should surface this in your app\'s privacy controls. The flag is persisted across app restarts.',
  },
  {
    q: 'How does the AI generate prompt copy?',
    a: 'You paste your existing app store reviews into the dashboard. The AI (using your own LLM key) identifies recurring praise themes — e.g. "offline mode", "fast sync", "clean UI" — and writes pre-prompts that mention those themes naturally. You review and accept the ones you want to use. Review text is processed in memory and never stored.',
  },
  {
    q: 'What happens after the beta ends?',
    a: 'We will give at least 30 days notice before any pricing changes. Early adopters who provide feedback during beta will receive preferred pricing. We intend to keep a free Indie tier (2,500 impressions/month) permanently.',
  },
];

function FAQ() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl" style={{ letterSpacing: '-0.025em' }}>
          Frequently asked questions
        </h2>

        <dl className="mt-12 space-y-4">
          {FAQS.map(item => (
            <details
              key={item.q}
              className="group rounded-xl border border-gray-200 bg-white px-6 py-5 open:shadow-sm transition-shadow"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-gray-900">
                {item.q}
                <span className="flex-shrink-0 text-brand-600 text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">{item.a}</p>
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
    <section className="bg-gradient-to-br from-[#0B8068] to-[#134e4a] py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl" style={{ letterSpacing: '-0.025em' }}>
          Your next 100 reviews start here
        </h2>
        <p className="mt-4 text-lg text-teal-100">
          Set up in a day. No credit card required. Apple-compliant out of the box.
        </p>
        <a
          href={`${ADMIN_URL}/signup`}
          className="mt-10 inline-flex items-center gap-2 rounded-xl bg-white px-10 py-4 text-lg font-semibold text-brand-700 shadow-lg hover:bg-teal-50 transition-colors"
        >
          Create your free account →
        </a>
        <p className="mt-4 text-sm text-teal-200">
          Already have an account?{' '}
          <a href={`${ADMIN_URL}/login`} className="underline hover:text-white">
            Log in
          </a>
        </p>
      </div>
    </section>
  );
}
