import Link from 'next/link';
import { SurgeMark } from '@/components/SurgeMark';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-sm text-center">
        <div className="mb-5 flex justify-center">
          <SurgeMark size="hero" />
        </div>
        <h1 className="mb-1 text-3xl font-bold tracking-tight text-gray-900" style={{ letterSpacing: '-0.025em' }}>
          Prompt<span style={{ color: '#0E9E80' }}>Surge</span>
        </h1>
        <p className="mb-8 text-base text-gray-500">
          AI-powered review prompts for mobile apps.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
