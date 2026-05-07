import type { Metadata } from 'next';
import { ADMIN_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Pricing — PromptSurge',
  description: 'Free during beta. Full access, no credit card required. Plans scale with impression volume after beta.',
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
            Free while we&apos;re in beta — full access, no credit card, no time limit.
            Plans will scale with impression volume once we launch paid tiers.
          </p>
        </div>

        {/* Beta highlight */}
        <div className="mt-12 rounded-2xl border-2 border-brand-600 bg-white p-8 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
                Active now — beta
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">Full access</p>
              <p className="mt-1 text-gray-500">Everything included, completely free for early adopters</p>
            </div>
            <div className="text-right">
              <p className="text-5xl font-black text-brand-600">$0</p>
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

        {/* Post-beta tier comparison */}
        <div className="mt-16">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900" style={{ letterSpacing: '-0.025em' }}>
            Upcoming tiers — post-beta
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Exact prices TBD. Beta adopters will receive preferred pricing.
          </p>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-4 text-left font-semibold text-gray-900">Feature</th>
                  <th className="px-4 py-4 text-center font-semibold text-gray-900">
                    Indie<br /><span className="font-normal text-xs text-gray-500">Free forever</span>
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-gray-900">
                    Startup<br /><span className="font-normal text-xs text-gray-500">Pricing TBD</span>
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-gray-900">
                    Growth<br /><span className="font-normal text-xs text-gray-500">Pricing TBD</span>
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-gray-900">
                    Enterprise<br /><span className="font-normal text-xs text-gray-500">Contact us</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ['Prompt impressions / month', '2,500', '30,000', '250,000', 'Unlimited'],
                  ['Apps', 'Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'],
                  ['Team members', 'Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'],
                  ['Android SDK', true, true, true, true],
                  ['iOS SDK (coming soon)', true, true, true, true],
                  ['AI prompt generation (BYOK)', true, true, true, true],
                  ['Multi-locale prompts', true, true, true, true],
                  ['Real-time metrics dashboard', true, true, true, true],
                  ['CSV export', true, true, true, true],
                  ['GEO & per-version breakdown', false, true, true, true],
                  ['Priority support', false, false, true, true],
                  ['SLA & dedicated CSM', false, false, false, true],
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-6 py-3.5 text-gray-700">{row[0]}</td>
                    {row.slice(1).map((cell, j) => (
                      <td key={j} className="px-4 py-3.5 text-center">
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

        {/* Beta promise + contact */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900">Our beta promise</h3>
            <p className="mt-2 text-sm text-gray-600">
              We&apos;ll give at least <strong>30 days notice</strong> before any pricing changes.
              We plan to keep the Indie tier free permanently. Early adopters will receive preferred pricing on paid tiers.
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900">Questions about pricing?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Reach out at{' '}
              <a href="mailto:hello@promptsurge.me" className="text-brand-600 hover:underline font-medium">
                hello@promptsurge.me
              </a>
              . For Enterprise or high-volume custom plans, we&apos;ll work directly with you.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
