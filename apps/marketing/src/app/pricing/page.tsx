import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — PromptSurge',
  description: 'Free during beta. Full access, no credit card required.',
};

import { ADMIN_URL } from '@/lib/constants';

export default function PricingPage() {
  return (
    <main className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Pricing
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Free while we&apos;re in beta. Full access, no credit card, no time limit.
        </p>

        <div className="mt-12 rounded-2xl border-2 border-brand-600 bg-white p-8 shadow-lg text-left">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">Beta access</p>
              <p className="mt-1 text-gray-500">Everything included, free for early adopters</p>
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
                  'Apple 5.6.1 compliant out of the box',
                  'Opt-out / opt-in API',
                ],
              },
              {
                category: 'AI & prompts',
                items: [
                  'AI prompt generation (bring your own LLM key)',
                  'OpenAI, Anthropic, Gemini support',
                  'Review theme extraction from paste',
                  'Multi-locale prompt texts',
                  'Up to 10 theme analyses per day per app',
                ],
              },
              {
                category: 'Analytics',
                items: [
                  'Metrics dashboard',
                  'Tap-through rate tracking',
                  'GEO breakdown (top 20 locales)',
                  'Reviews-per-install metric',
                  'CSV export for all charts',
                ],
              },
              {
                category: 'Platform',
                items: [
                  'Unlimited apps',
                  'Unlimited team members',
                  'API key rotation',
                  'LLM usage logging',
                  'Email support',
                ],
              },
            ].map(group => (
              <div key={group.category}>
                <p className="font-semibold text-gray-700 text-sm mb-3">{group.category}</p>
                <ul className="space-y-2">
                  {group.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-brand-500 flex-shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <a
            href={`${ADMIN_URL}/signup`}
            className="mt-10 block rounded-xl bg-brand-600 px-6 py-4 text-center font-semibold text-white hover:bg-brand-700 transition-colors text-lg"
          >
            Create a free account →
          </a>
        </div>

        <div className="mt-10 rounded-xl bg-gray-50 border border-gray-200 p-6 text-left">
          <h2 className="font-semibold text-gray-900">What happens after the beta?</h2>
          <p className="mt-2 text-sm text-gray-600">
            We will give at least <strong>30 days notice</strong> before any pricing changes. Early adopters who
            provide feedback during beta will receive preferred pricing on paid tiers. We are not planning to
            remove a free tier — only to add paid tiers for larger teams and higher volume.
          </p>
          <p className="mt-3 text-sm text-gray-600">
            Questions?{' '}
            <a href="mailto:hello@promptsurge.me" className="text-brand-600 hover:underline">
              hello@promptsurge.me
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
