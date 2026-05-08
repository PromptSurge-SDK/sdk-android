'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  inviteToken: string;
  hasName: boolean;
}

export function AcceptInviteClient({ inviteToken, hasName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Name collection state — only shown when the account has no name yet
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameSaved, setNameSaved] = useState(hasName);

  async function saveName(): Promise<boolean> {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      return false;
    }
    const res = await fetch('/api/account/update-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
    });
    if (!res.ok) {
      setError('Could not save your name. Please try again.');
      return false;
    }
    setNameSaved(true);
    return true;
  }

  async function handleAccept() {
    setLoading(true);
    setError('');

    if (!nameSaved) {
      const ok = await saveName();
      if (!ok) {
        setLoading(false);
        return;
      }
    }

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
    <div className="space-y-4">
      {!nameSaved && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-700">
            Before joining, please tell us your name so teammates can identify you.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      )}

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
