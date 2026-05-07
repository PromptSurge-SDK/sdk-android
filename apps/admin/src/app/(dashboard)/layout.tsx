import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/api';
import { getSessionToken } from '@/lib/session';
import { BrandLockup } from '@/components/SurgeMark';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let email = '';
  try {
    const me = await getMe(token);
    email = me.email;
  } catch {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--neutral-50)' }}>
      <header className="border-b" style={{ background: '#fff', borderColor: 'var(--color-border)' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/dashboard">
            <BrandLockup size="nav" />
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm sm:inline" style={{ color: 'var(--ink-60)' }}>{email}</span>
            <Link
              href="/account"
              className="transition-opacity hover:opacity-70"
              title="Account settings"
              style={{ color: 'var(--ink-60)' }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </Link>
            <form action="/logout" method="POST">
              <button
                type="submit"
                className="text-sm transition-opacity hover:opacity-70"
                style={{ color: 'var(--ink-60)' }}
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex flex-1">{children}</main>
    </div>
  );
}
