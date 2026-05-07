import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — PromptSurge',
  description: 'PromptSurge terms of service.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      {/* Draft banner */}
      <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
        <p className="font-semibold text-amber-800">📋 Draft — awaiting legal review</p>
        <p className="mt-1 text-sm text-amber-700">
          These terms of service are a draft and have not yet been reviewed by counsel.
          They will be replaced with a counsel-reviewed version before public launch (M8.5).
        </p>
      </div>

      <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: May 2026 (draft)</p>

      <div className="prose prose-gray mt-8 max-w-none">
        <h2>1. Acceptance of terms</h2>
        <p>
          By creating a PromptSurge account or using the PromptSurge SDK, you agree to these Terms of Service.
          If you are using PromptSurge on behalf of an organization, you represent that you have authority to bind
          that organization to these terms.
        </p>

        <h2>2. Service description</h2>
        <p>
          PromptSurge provides a platform for mobile app developers to manage in-app review prompts, extract
          themes from user reviews using AI, and track prompt performance metrics. The service consists of
          an Android SDK, a web-based admin panel, and an API.
        </p>

        <h2>3. LLM costs disclaimer</h2>
        <p>
          <strong>PromptSurge does not pay for LLM API calls on your behalf.</strong> When you use AI-powered
          features (prompt generation, review theme extraction), those calls are made using the LLM API key
          you configure in the dashboard. You are responsible for all costs incurred with your chosen LLM provider.
          PromptSurge displays estimated costs before analysis runs and logs actual token usage in the admin panel.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You may not use PromptSurge to:</p>
        <ul>
          <li>Manipulate app store ratings in violation of Apple or Google platform policies</li>
          <li>Collect or process personal data of app end-users in violation of applicable law</li>
          <li>Circumvent rate limits or abuse the API</li>
          <li>Resell or sublicense the service without written permission</li>
        </ul>
        <p>
          You are responsible for ensuring your use of the SDK complies with Apple App Store Review Guideline 5.6.1
          and Google Play&apos;s in-app review policy.
        </p>

        <h2>5. Beta service</h2>
        <p>
          PromptSurge is currently in beta. The service is provided &ldquo;as is&rdquo; without any uptime guarantee.
          We will provide at least 30 days notice before introducing paid tiers or removing features currently available
          for free.
        </p>

        <h2>6. Intellectual property</h2>
        <p>
          You retain ownership of your app data, review text, and generated prompts. PromptSurge retains ownership
          of the SDK, API, and admin panel. We may use aggregated, anonymised usage data to improve the service.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, PromptSurge is not liable for indirect, incidental, or
          consequential damages, including lost revenue, lost data, or App Store rating changes.
          Our total liability in any 12-month period is limited to the amount you paid us during that period
          (which during the free beta is zero).
        </p>

        <h2>8. Termination</h2>
        <p>
          You may delete your account at any time. We may suspend or terminate accounts that violate these terms.
          A 7-day soft-delete window applies to account deletion.
        </p>

        <h2>9. Changes to terms</h2>
        <p>
          We will notify you by email at least 14 days before making material changes to these terms.
          Continued use after the effective date constitutes acceptance.
        </p>

        <h2>10. Contact</h2>
        <p>
          For questions about these terms: <a href="mailto:hello@promptsurge.me">hello@promptsurge.me</a>
        </p>
      </div>
    </main>
  );
}
