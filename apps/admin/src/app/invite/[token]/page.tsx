import { redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';
import { AcceptInviteClient } from './AcceptInviteClient';

interface Props {
  params: { token: string };
}

async function fetchInvitePreview(token: string) {
  const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';
  const res = await fetch(`${API_URL}/admin/invites/${token}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: (body.error as string) ?? 'invite_not_found' };
  }
  return res.json() as Promise<{
    id: string;
    email: string;
    role: string;
    orgName: string;
    expiresAt: string;
  }>;
}

export default async function InvitePage({ params }: Props) {
  const sessionToken = getSessionToken();

  // If not logged in → redirect to login with ?redirect back here
  if (!sessionToken) {
    redirect(`/login?next=/invite/${params.token}`);
  }

  const preview = await fetchInvitePreview(params.token);

  if ('error' in preview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-sm rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-4xl">😕</div>
          <h1 className="mb-2 text-lg font-semibold text-gray-900">Invite not valid</h1>
          <p className="mb-6 text-sm text-gray-500">
            {preview.error === 'invite_already_accepted'
              ? 'This invite has already been accepted.'
              : preview.error === 'invite_expired'
              ? 'This invite has expired. Ask your team admin to send a new one.'
              : 'This invite link is invalid or has been revoked.'}
          </p>
          <a
            href="/dashboard"
            className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
          <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <h1 className="mb-1 text-lg font-semibold text-gray-900">
          Join {preview.orgName}
        </h1>
        <p className="mb-1 text-sm text-gray-500">
          You&apos;ve been invited as a{' '}
          <span className="font-medium capitalize text-gray-700">{preview.role}</span>.
        </p>
        <p className="mb-6 text-xs text-gray-400">
          Invite sent to {preview.email} · Expires {new Date(preview.expiresAt).toLocaleDateString()}
        </p>
        <AcceptInviteClient inviteToken={params.token} />
      </div>
    </div>
  );
}
