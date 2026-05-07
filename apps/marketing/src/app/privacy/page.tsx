import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — PromptSurge',
  description: 'PromptSurge privacy policy.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      {/* Draft banner */}
      <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
        <p className="font-semibold text-amber-800">📋 Draft — awaiting legal review</p>
        <p className="mt-1 text-sm text-amber-700">
          This privacy policy is a draft and has not yet been reviewed by counsel.
          It will be replaced with a counsel-reviewed version before public launch (M8.5).
        </p>
      </div>

      <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: May 2026 (draft)</p>

      <div className="prose prose-gray mt-8 max-w-none">
        <h2>1. What we collect</h2>
        <p>
          PromptSurge collects the following data through the Android SDK and admin panel:
        </p>
        <ul>
          <li>
            <strong>Hashed device ID:</strong> A SHA-256 hash of the device&apos;s Android ID combined with
            the host app&apos;s package name. This cannot be reversed to obtain the original Android ID.
          </li>
          <li>
            <strong>App version, SDK version, locale:</strong> Used for metrics aggregation and prompt
            localization. No personal data.
          </li>
          <li>
            <strong>Event types:</strong> Which prompt events occurred (shown, confirmed, dismissed,
            native prompt requested, first open). No message content.
          </li>
          <li>
            <strong>Developer account data:</strong> Email address and hashed password for admin panel
            authentication.
          </li>
          <li>
            <strong>LLM API keys:</strong> Encrypted at rest using libsodium sealed-box encryption.
            Never returned in API responses beyond a masked last-4 display.
          </li>
        </ul>

        <h2>2. What we do not collect</h2>
        <ul>
          <li>Raw Android ID or any other persistent device identifier</li>
          <li>IP addresses beyond what is included in server access logs (retained ≤ 30 days)</li>
          <li>Pasted app review text — processed in memory only, never stored</li>
          <li>Names, emails, or any PII of end users of the host app</li>
          <li>Location data beyond the device locale tag (e.g. &ldquo;en-US&rdquo;)</li>
        </ul>

        <h2>3. How we use data</h2>
        <ul>
          <li>To render the metrics dashboard for app developers</li>
          <li>To generate AI-powered review prompt suggestions (via developer&apos;s own LLM provider)</li>
          <li>To enforce rate limits and prevent abuse</li>
          <li>To improve the PromptSurge product</li>
        </ul>

        <h2>4. Data sharing</h2>
        <p>
          We do not sell personal data. We share data with the following sub-processors:
        </p>
        <ul>
          <li><strong>Supabase / PostgreSQL:</strong> Primary data store (hosted in the EU/US)</li>
          <li><strong>Fly.io:</strong> API hosting</li>
          <li><strong>Vercel:</strong> Admin panel hosting</li>
          <li><strong>AWS S3:</strong> Image upload storage</li>
        </ul>
        <p>Each sub-processor is bound by a Data Processing Agreement.</p>

        <h2>5. Retention</h2>
        <ul>
          <li>Event data: retained indefinitely unless you delete your app or account</li>
          <li>Server access logs (including IP): retained for 30 days</li>
          <li>Developer accounts: a 7-day soft-delete window applies before hard deletion</li>
        </ul>

        <h2>6. Your rights (GDPR / CCPA)</h2>
        <p>
          You have the right to access, correct, export, or delete your data. To exercise these rights,
          email <a href="mailto:hello@promptsurge.me">hello@promptsurge.me</a>. We will respond within 30 days.
        </p>
        <p>
          <em>Note: Data export and deletion endpoints in the admin panel are planned for M8.5.</em>
        </p>

        <h2>7. Contact</h2>
        <p>
          For privacy questions: <a href="mailto:hello@promptsurge.me">hello@promptsurge.me</a>
        </p>
      </div>
    </main>
  );
}
