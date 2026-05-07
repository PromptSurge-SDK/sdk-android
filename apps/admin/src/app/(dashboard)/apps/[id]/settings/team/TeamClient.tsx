'use client';

import { useState } from 'react';
import type { OrgInfo, OrgMember, OrgInvite } from '@/lib/api';

interface Props {
  org: OrgInfo;
  initialMembers: OrgMember[];
  initialInvites: OrgInvite[];
}

export function TeamClient({ org, initialMembers, initialInvites }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'owner'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');

  const isOwner = org.myRole === 'owner';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setInviting(true);
    setInviteError('');
    try {
      const res = await fetch('/api/org?sub=invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to send invite');
      }
      const data = await res.json();
      setInvites((prev) => [data.invite, ...prev]);
      setEmail('');
      // Auto-copy invite URL
      try {
        await navigator.clipboard.writeText(data.inviteUrl);
        setCopiedUrl(data.inviteUrl);
        setTimeout(() => setCopiedUrl(''), 3000);
      } catch {}
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string, memberEmail: string) {
    if (!confirm(`Remove ${memberEmail} from the team?`)) return;
    const res = await fetch(`/api/org?sub=members&id=${memberId}`, { method: 'DELETE' });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!confirm('Revoke this invite?')) return;
    const res = await fetch(`/api/org?sub=invites&id=${inviteId}`, { method: 'DELETE' });
    if (res.ok) {
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    }
  }

  async function handleCopyInvite(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 3000);
  }

  return (
    <div className="space-y-8">
      {/* Members table */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Members</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {members.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No members yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => (
                  <tr key={m.id} className="flex items-center justify-between px-4 py-3">
                    <td className="flex flex-col">
                      <span className="font-medium text-gray-900">{m.developer.email}</span>
                      <span className="text-xs capitalize text-gray-400">{m.role}</span>
                    </td>
                    <td>
                      {isOwner && m.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(m.id, m.developer.email)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Invite form — owners only */}
      {isOwner && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Invite a team member</h2>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'member' | 'owner')}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {inviting ? 'Inviting…' : 'Invite'}
            </button>
          </form>
          {inviteError && <p className="mt-2 text-xs text-red-600">{inviteError}</p>}
          {copiedUrl && (
            <p className="mt-2 text-xs text-green-600">
              Invite link copied to clipboard!
            </p>
          )}
        </section>
      )}

      {/* Pending invites */}
      {isOwner && invites.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Pending invites</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {invites.map((inv) => (
                  <tr key={inv.id} className="flex items-center justify-between px-4 py-3">
                    <td className="flex flex-col">
                      <span className="font-medium text-gray-900">{inv.email}</span>
                      <span className="text-xs capitalize text-gray-400">
                        {inv.role} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="flex gap-3">
                      <button
                        onClick={() => handleCopyInvite(inv.token)}
                        className="text-xs text-brand-600 hover:text-brand-800"
                      >
                        {copiedUrl.includes(inv.token) ? 'Copied!' : 'Copy link'}
                      </button>
                      <button
                        onClick={() => handleRevokeInvite(inv.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
