import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white p-8">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">
          PS
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-gray-900">PromptSurge</h1>
        <p className="mb-8 text-lg text-gray-500">
          Boost your app review rate with smart, policy-compliant pre-prompts.
          Integrate in minutes on Android.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Log in
          </Link>
        </div>
        <p className="mt-10 text-xs text-gray-400">
          API at{' '}
          <code className="font-mono">
            {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}
          </code>
        </p>
      </div>
    </main>
  );
}
