'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  inviteToken: string;
}

export function AcceptInviteClient({ inviteToken }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/org-invite?token=${inviteToken}&action=accept`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to accept invite');
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? 'Joining…' : 'Accept invite & join'}
      </button>
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
      <a
        href="/dashboard"
        className="block text-center text-xs text-gray-400 hover:text-gray-600"
      >
        Decline — go to dashboard
      </a>
    </div>
  );
}
