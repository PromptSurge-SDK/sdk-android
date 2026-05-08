'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Me, LinkedOAuthAccount } from '@/lib/api';
import { ALL_PROVIDERS, PROVIDER_META } from '@/components/OAuthButtons';

// ─── Profile section ──────────────────────────────────────────────────────────

function ProfileSection({ me }: { me: Me }) {
  const [firstName, setFirstName] = useState(me.firstName ?? '');
  const [lastName, setLastName] = useState(me.lastName ?? '');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setMsg({ type: 'err', text: 'Both first and last name are required.' });
      return;
    }
    setLoading(true);
    setMsg(null);
    const res = await fetch('/api/account/update-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
    });
    setLoading(false);
    if (res.ok) {
      setMsg({ type: 'ok', text: 'Name updated.' });
    } else {
      setMsg({ type: 'err', text: 'Failed to update name.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <label className="block text-sm font-medium text-gray-700">First name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoComplete="given-name"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="block text-sm font-medium text-gray-700">Last name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            autoComplete="family-name"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>
      {msg && (
        <p className={`text-xs ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save name'}
      </button>
    </form>
  );
}

interface Props {
  me: Me;
  linkedAccounts: LinkedOAuthAccount[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

// ─── Password section ─────────────────────────────────────────────────────────

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setMsg({ type: 'err', text: 'New passwords do not match.' });
      return;
    }
    if (newPw.length < 8) {
      setMsg({ type: 'err', text: 'Password must be at least 8 characters.' });
      return;
    }
    setLoading(true);
    setMsg(null);
    const endpoint = hasPassword ? '/api/account/change-password' : '/api/account/set-password';
    const body = hasPassword
      ? JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
      : JSON.stringify({ newPassword: newPw });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    setLoading(false);
    if (res.ok) {
      setMsg({ type: 'ok', text: 'Password updated successfully.' });
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      const errorMap: Record<string, string> = {
        invalid_password: 'Current password is incorrect.',
        password_too_short: 'Password must be at least 8 characters.',
        already_has_password: 'Use "Change password" instead.',
      };
      setMsg({ type: 'err', text: errorMap[data.error ?? ''] ?? 'Failed to update password.' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      {!hasPassword && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Your account uses social sign-in only. Set a password to also enable email login.
        </p>
      )}
      {hasPassword && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Current password</label>
          <input
            type="password"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      )}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {hasPassword ? 'New password' : 'Password'}
        </label>
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          required
          minLength={8}
          placeholder="8+ characters"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Confirm password</label>
        <input
          type="password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      {msg && (
        <p className={`text-xs ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
          {msg.text}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
      </button>
    </form>
  );
}

// ─── Connected accounts section ───────────────────────────────────────────────

function ConnectedAccountsSection({
  linkedAccounts,
  hasPassword,
}: {
  linkedAccounts: LinkedOAuthAccount[];
  hasPassword: boolean;
}) {
  const [accounts, setAccounts] = useState(linkedAccounts);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [error, setError] = useState('');

  const connectedProviders = new Set(accounts.map((a) => a.provider));
  const canUnlink = (provider: string) =>
    hasPassword || connectedProviders.size > 1;

  async function handleUnlink(provider: string) {
    if (!canUnlink(provider)) {
      setError('Cannot remove last sign-in method. Set a password first.');
      return;
    }
    if (!confirm(`Disconnect ${provider}?`)) return;
    setUnlinking(provider);
    setError('');
    const res = await fetch('/api/account/oauth/unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    setUnlinking(null);
    if (res.ok) {
      setAccounts((prev) => prev.filter((a) => a.provider !== provider));
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (data.error === 'last_login_method') {
        setError('Cannot remove your last sign-in method.');
      } else {
        setError('Failed to disconnect provider.');
      }
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {ALL_PROVIDERS.map((id) => {
        const meta = PROVIDER_META[id];
        const linked = accounts.find((a) => a.provider === id);
        return (
          <div
            key={id}
            className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-600">{meta.icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                {linked?.email && (
                  <p className="text-xs text-gray-400">{linked.email}</p>
                )}
              </div>
            </div>
            {linked ? (
              <button
                onClick={() => handleUnlink(id)}
                disabled={unlinking === id}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                {unlinking === id ? 'Disconnecting…' : 'Disconnect'}
              </button>
            ) : (
              <a
                href={`/api/auth/${id}?action=link&next=/account`}
                className="text-xs font-medium text-brand-600 hover:text-brand-800"
              >
                Connect
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Delete account section ───────────────────────────────────────────────────

function DeleteAccountSection() {
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (confirm !== 'DELETE') return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/account/delete', { method: 'DELETE' });
    if (res.ok) {
      await fetch('/api/session', { method: 'DELETE' });
      router.push('/signup');
    } else {
      setLoading(false);
      const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
      if (data.error === 'owns_apps') {
        setError(data.message ?? 'You must delete or transfer your apps first.');
      } else {
        setError('Failed to delete account. Please try again.');
      }
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Permanently delete your account and all associated data. This cannot be undone.
        You must delete or transfer all apps you own before deleting your account.
      </p>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <form onSubmit={handleDelete} className="flex max-w-sm items-center gap-3">
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder='Type "DELETE" to confirm'
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <button
          type="submit"
          disabled={confirm !== 'DELETE' || loading}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
        >
          {loading ? 'Deleting…' : 'Delete'}
        </button>
      </form>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function AccountClient({ me, linkedAccounts }: Props) {
  return (
    <div>
      <Section title="Profile">
        <ProfileSection me={me} />
      </Section>

      <Section title={me.hasPassword ? 'Change password' : 'Set a password'}>
        <PasswordSection hasPassword={me.hasPassword} />
      </Section>

      <Section title="Connected accounts">
        <ConnectedAccountsSection linkedAccounts={linkedAccounts} hasPassword={me.hasPassword} />
      </Section>

      <Section title="Danger zone">
        <DeleteAccountSection />
      </Section>
    </div>
  );
}
