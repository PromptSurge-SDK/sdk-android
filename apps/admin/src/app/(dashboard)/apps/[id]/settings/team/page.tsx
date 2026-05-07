import { redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';
import { getOrg, getOrgMembers, getOrgInvites } from '@/lib/api';
import { TeamClient } from './TeamClient';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const token = getSessionToken();
  if (!token) redirect('/login');

  const [org, members, invites] = await Promise.all([
    getOrg(token),
    getOrgMembers(token),
    getOrgInvites(token),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Team</h1>
      <p className="mb-6 text-sm text-gray-500">
        Manage who has access to <span className="font-medium text-gray-700">{org.name}</span>.
      </p>
      <TeamClient org={org} initialMembers={members} initialInvites={invites} />
    </div>
  );
}
