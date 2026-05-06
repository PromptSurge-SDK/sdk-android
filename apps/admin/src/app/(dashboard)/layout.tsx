import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              PS
            </div>
            <span className="font-semibold text-gray-900">PromptSurge</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{email}</span>
            <form action="/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
