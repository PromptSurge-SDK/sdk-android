'use client';

import { useState } from 'react';
import type { OrgInfo, OrgMember, OrgInvite } from '@/lib/api';

interface Props {
  org: OrgInfo;
  currentDeveloperId: string;
  initialMembers: OrgMember[];
  initialInvites: OrgInvite[];
}

function memberDisplayName(developer: OrgMember['developer']): string {
  const full = [developer.firstName, developer.lastName].filter(Boolean).join(' ');
  return full || developer.email;
}

// ─── Inline name editor ───────────────────────────────────────────────────────

interface EditNameRowProps {
  member: OrgMember;
  isSelf: boolean;
  onSaved: (memberId: string, firstName: string, lastName: string) => void;
  onCancel: () => void;
}

function EditNameRow({ member, isSelf, onSaved, onCancel }: EditNameRowProps) {
  const [firstName, setFirstName] = useState(member.developer.firstName ?? '');
  const [lastName, setLastName] = useState(member.developer.lastName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Both fields are required.');
      return;
    }
    setSaving(true);
    setError('');

    const endpoint = isSelf
      ? '/api/account/update-profile'
      : `/api/org?sub=members&id=${member.id}`;
    const method = 'PATCH';

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved(member.id, firstName.trim(), lastName.trim());
    } else {
      setError('Failed to save. Please try again.');
    }
  }

  return (
    <tr className="flex flex-col gap-2 px-4 py-3 bg-gray-50">
      <td className="w-full">
        <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            autoComplete="given-name"
            autoFocus
            className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            autoComplete="family-name"
            className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </form>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TeamClient({ org, currentDeveloperId, initialMembers, initialInvites }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'owner'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');

  const isOwner = org.myRole === 'owner';
  const myMember = members.find((m) => m.developer.id === currentDeveloperId);

  function handleNameSaved(memberId: string, firstName: string, lastName: string) {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? { ...m, developer: { ...m.developer, firstName, lastName } }
          : m
      )
    );
    setEditingMemberId(null);
  }

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

  async function handleRemoveMember(memberId: string, developer: OrgMember['developer']) {
    const name = memberDisplayName(developer);
    if (!confirm(`Remove ${name} from the team?`)) return;
    const res = await fetch(`/api/org?sub=members&id=${memberId}`, { method: 'DELETE' });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!confirm('Revoke this invite?')) return;
    const res = await fetch(`/api/org?sub=invites&id=${inviteId}`, { method: 'DELETE' });
    if (res.ok) setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  async function handleCopyInvite(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 3000);
  }

  return (
    <div className="space-y-8">
      {/* Your role banner */}
      {myMember && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <span>You are a</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${myMember.role === 'owner' ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-600'}`}>
            {myMember.role}
          </span>
          <span>of <span className="font-medium text-gray-900">{org.name}</span></span>
        </div>
      )}

      {/* Members table */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Members</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {members.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No members yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => {
                  const isMe = m.developer.id === currentDeveloperId;
                  const hasName = !!(m.developer.firstName || m.developer.lastName);
                  const displayName = memberDisplayName(m.developer);
                  const canEdit = isMe || isOwner;

                  if (editingMemberId === m.id) {
                    return (
                      <EditNameRow
                        key={m.id}
                        member={m}
                        isSelf={isMe}
                        onSaved={handleNameSaved}
                        onCancel={() => setEditingMemberId(null)}
                      />
                    );
                  }

                  return (
                    <tr key={m.id} className="flex items-center justify-between px-4 py-3">
                      <td className="flex min-w-0 flex-col">
                        {hasName ? (
                          <>
                            <span className="font-medium text-gray-900">
                              {displayName}
                              {isMe && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
                            </span>
                            <span className="text-xs text-gray-400">{m.developer.email}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-gray-900">
                              {m.developer.email}
                              {isMe && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
                            </span>
                            <span className="text-xs text-amber-500">No name set</span>
                          </>
                        )}
                        <span className="text-xs capitalize text-gray-400">{m.role}</span>
                      </td>
                      <td className="flex shrink-0 items-center gap-3">
                        {canEdit && (
                          <button
                            onClick={() => setEditingMemberId(m.id)}
                            className="text-xs text-brand-600 hover:text-brand-800"
                          >
                            {hasName ? 'Edit' : isMe ? 'Add name' : 'Set name'}
                          </button>
                        )}
                        {isOwner && !isMe && m.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(m.id, m.developer)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
            <p className="mt-2 text-xs text-green-600">Invite link copied to clipboard!</p>
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
