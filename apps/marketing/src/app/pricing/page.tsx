import type { Metadata } from 'next';
import { ADMIN_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Pricing — PromptSurge',
  description: 'Free Indie plan forever. Startup at $39/mo, Growth at $99/mo. Pricing based on prompt impressions — one count per dialog shown to a user.',
};

const CHECK = (
  <svg className="h-4 w-4 flex-shrink-0 text-brand-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const DASH = (
  <svg className="h-4 w-4 flex-shrink-0 text-gray-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
);

const PLANS = [
  {
    name: 'Indie',
    monthly: 'Free',
    yearly: 'Free',
    impressions: '500 / mo',
    highlight: false,
    cta: 'Get started free',
    ctaHref: `${ADMIN_URL}/signup`,
  },
  {
    name: 'Startup',
    monthly: '$39',
    yearly: '$31',
    impressions: '10,000 / mo',
    highlight: false,
    cta: 'Start Startup',
    ctaHref: `${ADMIN_URL}/signup`,
  },
  {
    name: 'Growth',
    monthly: '$99',
    yearly: '$79',
    impressions: '100,000 / mo',
    highlight: true,
    cta: 'Start Growth',
    ctaHref: `${ADMIN_URL}/signup`,
  },
  {
    name: 'Enterprise',
    monthly: 'Custom',
    yearly: 'Custom',
    impressions: 'Unlimited',
    highlight: false,
    cta: 'Contact us',
    ctaHref: 'mailto:hello@promptsurge.me',
  },
];

export default function PricingPage() {
  return (
    <main className="py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl" style={{ letterSpacing: '-0.03em' }}>
            Pricing
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            Starts free. Scales with your app.
            Billed on <strong>prompt impressions</strong> — one count each time the pre-prompt dialog is shown to a user.
          </p>
        </div>

        {/* Plan cards */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border bg-white p-6 ${
                plan.highlight
                  ? 'border-brand-500 shadow-lg ring-1 ring-brand-500'
                  : 'border-gray-200 shadow-sm'
              }`}
            >
              {plan.highlight && (
                <div className="mb-3 inline-flex self-start rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
                  Most popular
                </div>
              )}
              <p className="text-base font-semibold text-gray-900">{plan.name}</p>
              <div className="mt-3">
                <span className="text-3xl font-black text-gray-900">{plan.monthly}</span>
                {plan.monthly !== 'Free' && plan.monthly !== 'Custom' && (
                  <span className="ml-1 text-sm text-gray-400">/ mo</span>
                )}
              </div>
              {plan.monthly !== 'Free' && plan.monthly !== 'Custom' && (
                <p className="mt-0.5 text-xs text-gray-400">{plan.yearly}/mo billed annually</p>
              )}
              {plan.monthly === 'Free' && (
                <p className="mt-0.5 text-xs text-gray-400">Free forever</p>
              )}
              <p className="mt-3 text-xs font-semibold text-brand-600">
                {plan.impressions} prompt impressions
              </p>
              <a
                href={plan.ctaHref}
                className={`mt-5 block rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Feature comparison table */}
        <div className="mt-16">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900" style={{ letterSpacing: '-0.025em' }}>
            Full feature comparison
          </h2>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-4 text-left font-semibold text-gray-900">Feature</th>
                  <th className="px-4 py-4 text-center font-semibold text-gray-900">
                    Indie<br /><span className="font-normal text-xs text-gray-500">Free</span>
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-gray-900">
                    Startup<br /><span className="font-normal text-xs text-gray-500">$39 / mo</span>
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-brand-700 bg-brand-50/40">
                    Growth<br /><span className="font-normal text-xs text-brand-500">$99 / mo</span>
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-gray-900">
                    Enterprise<br /><span className="font-normal text-xs text-gray-500">Custom</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ['Prompt impressions / month', '500', '10,000', '100,000', 'Unlimited'],
                  ['Apps', 'Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'],
                  ['Team members', 'Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'],
                  ['Android SDK', true, true, true, true],
                  ['iOS SDK (coming soon)', true, true, true, true],
                  ['Apple guideline 5.6.1 compliant', true, true, true, true],
                  ['AI prompt generation (BYOK)', true, true, true, true],
                  ['Multi-locale prompt texts', true, true, true, true],
                  ['Review theme extraction', true, true, true, true],
                  ['Real-time metrics dashboard', true, true, true, true],
                  ['Holdout group analytics', true, true, true, true],
                  ['CSV export', false, true, true, true],
                  ['GEO & per-version breakdown', false, true, true, true],
                  ['Priority support', false, false, true, true],
                  ['SLA & dedicated CSM', false, false, false, true],
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-6 py-3.5 text-gray-700">{row[0]}</td>
                    {row.slice(1).map((cell, j) => (
                      <td key={j} className={`px-4 py-3.5 text-center ${j === 1 ? 'bg-brand-50/20' : ''}`}>
                        {typeof cell === 'boolean' ? (
                          cell ? CHECK : DASH
                        ) : (
                          <span className="font-medium text-gray-900">{cell}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ + contact */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900">What counts as a prompt impression?</h3>
            <p className="mt-2 text-sm text-gray-600">
              One prompt impression is counted each time the PromptSurge pre-prompt dialog is displayed to a user.
              It does not count the native rating sheet, event ingestion, or holdout-group devices (users in the holdout group never see the dialog).
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900">Questions or custom volume?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Reach out at{' '}
              <a href="mailto:hello@promptsurge.me" className="text-brand-600 hover:underline font-medium">
                hello@promptsurge.me
              </a>
              . For Enterprise or high-volume needs we&apos;ll work directly with you on a custom plan.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
