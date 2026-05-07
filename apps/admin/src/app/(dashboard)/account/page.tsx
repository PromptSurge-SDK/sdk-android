import { redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';
import { getMe, getLinkedOAuthAccounts } from '@/lib/api';
import { AccountClient } from './AccountClient';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let me: Awaited<ReturnType<typeof getMe>>;
  try {
    me = await getMe(token);
  } catch {
    redirect('/login');
  }

  const linkedAccounts = await getLinkedOAuthAccounts(token).catch(() => []);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Account settings</h1>
      <p className="mb-8 text-sm text-gray-500">{me.email}</p>
      <AccountClient me={me} linkedAccounts={linkedAccounts} />
    </div>
  );
}
