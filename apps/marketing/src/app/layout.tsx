import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { ADMIN_URL } from '@/lib/constants';
import { BrandLockup } from '@/components/SurgeMark';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PromptSurge — Turn app users into reviewers',
  description:
    'PromptSurge helps mobile developers grow App Store and Google Play ratings through AI-crafted, Apple-compliant in-app review prompts. Integrates in one day.',
  metadataBase: new URL('https://promptsurge.me'),
  openGraph: {
    title: 'PromptSurge — Turn app users into reviewers',
    description: 'AI-powered review prompts for Android and iOS apps. Free during beta.',
    url: 'https://promptsurge.me',
    siteName: 'PromptSurge',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PromptSurge — Turn app users into reviewers',
    description: 'AI-powered review prompts for Android and iOS apps. Free during beta.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <head>
        {/* Plausible Analytics — privacy-friendly, no cookies */}
        <script
          defer
          data-domain="promptsurge.me"
          src="https://plausible.io/js/script.js"
        />
      </head>
      <body className="bg-white font-sans text-gray-900 antialiased">
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <a href="/" aria-label="PromptSurge home">
          <BrandLockup size="nav" />
        </a>
        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 sm:flex">
          <a href="/#how-it-works" className="hover:text-brand-700 transition-colors">How it works</a>
          <a href="/docs" className="hover:text-brand-700 transition-colors">Docs</a>
          <a href="/pricing" className="hover:text-brand-700 transition-colors">Pricing</a>
          <a href={`${ADMIN_URL}/login`} className="hover:text-brand-700 transition-colors">Log in</a>
          <a
            href={`${ADMIN_URL}/signup`}
            className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 transition-colors"
          >
            Get started free
          </a>
        </nav>
        {/* Mobile CTA */}
        <a
          href={`${ADMIN_URL}/signup`}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 sm:hidden"
        >
          Get started
        </a>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <BrandLockup size="nav" />
            <p className="mt-3 text-sm text-gray-500">
              AI-powered review prompts for Android and iOS apps.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 text-sm">Product</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-500">
              <li><a href="/#how-it-works" className="hover:text-brand-700">How it works</a></li>
              <li><a href="/pricing" className="hover:text-brand-700">Pricing</a></li>
              <li><a href="/docs" className="hover:text-brand-700">Docs</a></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-700 text-sm">Legal</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-500">
              <li><a href="/privacy" className="hover:text-brand-700">Privacy policy</a></li>
              <li><a href="/terms" className="hover:text-brand-700">Terms of service</a></li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} PromptSurge. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
