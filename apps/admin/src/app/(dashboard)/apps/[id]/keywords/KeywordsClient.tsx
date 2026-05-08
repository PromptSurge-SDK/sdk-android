'use client';

import { useState, useTransition, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Keyword } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AuditEntry {
  id: string;
  keyword: string;
  action: 'added' | 'removed';
  type: 'positive' | 'negative';
  changedByEmail: string;
  changedAt: string;
}

interface AddResult {
  created: Keyword[];
  banned: string[];
  duplicates: string[];
}

interface Props {
  appId: string;
  keywords: Keyword[];
}

export function KeywordsClient({ appId, keywords }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<'positive' | 'negative'>('positive');
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<AddResult | null>(null);
  const [error, setError] = useState('');

  const [auditLog, setAuditLog] = useState<AuditEntry[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const [bannedList, setBannedList] = useState<string[] | null>(null);
  const [bannedTotal, setBannedTotal] = useState<number | null>(null);
  const [bannedLoading, setBannedLoading] = useState(false);
  const [showBanned, setShowBanned] = useState(false);
  const [copiedBanned, setCopiedBanned] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<'positive' | 'negative'>('positive');

  const positive = [...keywords.filter(k => k.type === 'positive')].sort((a, b) => a.text.localeCompare(b.text));
  const negative = [...keywords.filter(k => k.type === 'negative')].sort((a, b) => a.text.localeCompare(b.text));

  function wordCount(s: string) { return s.trim().split(/\s+/).filter(Boolean).length; }

  // Returns null if valid, or the offending token string if invalid
  function validateWordCount(raw: string): string | null {
    const tokens = raw.split(',').map(t => t.trim()).filter(Boolean);
    const bad = tokens.find(t => wordCount(t) > 2);
    return bad ?? null;
  }

  async function handleAdd() {
    const raw = newText.trim();
    if (!raw) return;
    const badToken = validateWordCount(raw);
    if (badToken) {
      setError(`"${badToken}" has more than 2 words. Keywords must be 1–2 words (e.g. "fast loading", "dark mode").`);
      return;
    }
    // Split on commas, trim each token
    const texts = raw.split(',').map(t => t.trim()).filter(Boolean);
    if (texts.length === 0) return;

    setAdding(true);
    setError('');
    setAddResult(null);
    try {
      const res = await fetch('/api/app-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, texts, type: newType }),
      });
      const data: AddResult = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? 'Failed');
      setAddResult(data);
      if (data.created.length > 0) {
        setNewText('');
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(keywordId: string) {
    setAddResult(null);
    await fetch('/api/app-keywords', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, keywordId }),
    });
    startTransition(() => router.refresh());
  }

  const loadAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/app-keywords?appId=${appId}&sub=audit-log`);
      const data = await res.json();
      setAuditLog(data.logs ?? []);
    } finally {
      setAuditLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    if (showAudit && auditLog === null) loadAuditLog();
  }, [showAudit, auditLog, loadAuditLog]);

  const loadBannedList = useCallback(async () => {
    setBannedLoading(true);
    try {
      const res = await fetch(`/api/app-keywords?appId=${appId}&sub=banned`);
      const data = await res.json();
      setBannedList(data.banned ?? []);
      setBannedTotal(data.total ?? 0);
    } finally {
      setBannedLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    // Always fetch the count on mount for the teaser message
    fetch(`/api/app-keywords?appId=${appId}&sub=banned`)
      .then(r => r.json())
      .then(d => { setBannedTotal(d.total ?? 0); setBannedList(d.banned ?? []); })
      .catch(() => {});
  }, [appId]);

  function toggleBanned() {
    setShowBanned(v => !v);
    if (!showBanned && bannedList === null) loadBannedList();
  }

  async function copyBannedList() {
    if (!bannedList) return;
    await navigator.clipboard.writeText(bannedList.join('\n'));
    setCopiedBanned(true);
    setTimeout(() => setCopiedBanned(false), 2000);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError('');
    setAddResult(null);
    try {
      const csv = await file.text();
      const res = await fetch('/api/app-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, csv, type: importType }),
      });
      const data: AddResult = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? 'Import failed');
      setAddResult(data);
      if (data.created.length > 0) startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6">
      {/* Add keyword */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-1 text-sm font-medium text-gray-700">Add keywords</p>
        <p className="mb-3 text-xs text-gray-400">Separate multiple keywords with commas — e.g. graphics, performance, battery life</p>
        <div className="flex items-center gap-2">
          <Input
            value={newText}
            onChange={e => { setNewText(e.target.value); setError(''); setAddResult(null); }}
            placeholder="fast loading, offline mode, dark theme…"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1"
          />
          <select
            value={newType}
            onChange={e => setNewType(e.target.value as 'positive' | 'negative')}
            className="rounded-md border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
          <Button onClick={handleAdd} disabled={adding || !newText.trim()}>
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {addResult && (
          <div className="mt-2 text-xs space-y-0.5">
            {addResult.created.length > 0 && (
              <p className="text-green-700">
                Added {addResult.created.length} keyword{addResult.created.length !== 1 ? 's' : ''}.
              </p>
            )}
            {addResult.banned.length > 0 && (
              <p className="text-amber-700">
                Skipped (banned): {addResult.banned.join(', ')}
              </p>
            )}
            {addResult.duplicates.length > 0 && (
              <p className="text-gray-500">
                Already exists: {addResult.duplicates.join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Keyword lists */}
      {keywords.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-green-700">Positive keywords ({positive.length})</h3>
            <p className="mb-3 text-xs text-gray-500">The LLM weaves these naturally into the pre-prompt copy.</p>
            {positive.length === 0 ? (
              <p className="text-sm text-gray-400 italic">None added yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {positive.map(k => (
                  <span key={k.id} className="flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm text-green-800">
                    {k.text}
                    <button
                      onClick={() => handleDelete(k.id)}
                      className="ml-1 text-green-400 hover:text-green-700"
                      aria-label={`Remove ${k.text}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-red-700">Negative keywords ({negative.length})</h3>
            <p className="mb-3 text-xs text-gray-500">The LLM avoids referencing these topics entirely.</p>
            {negative.length === 0 ? (
              <p className="text-sm text-gray-400 italic">None added yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {negative.map(k => (
                  <span key={k.id} className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-800">
                    {k.text}
                    <button
                      onClick={() => handleDelete(k.id)}
                      className="ml-1 text-red-400 hover:text-red-700"
                      aria-label={`Remove ${k.text}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-12 text-center">
          <p className="font-semibold text-gray-900">No keywords yet</p>
          <p className="mt-1 text-sm text-gray-500">Add positive keywords to steer AI-generated prompts, or negative ones to exclude topics.</p>
        </div>
      )}

      {/* CSV import / export */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-gray-700">Bulk import / export</p>
        <div className="flex flex-wrap items-center gap-3">
          {/* Export */}
          <a
            href={`/api/app-keywords?appId=${appId}&sub=export`}
            download="keywords.csv"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </a>

          {/* Import */}
          <div className="flex items-center gap-2">
            <select
              value={importType}
              onChange={e => setImportType(e.target.value as 'positive' | 'negative')}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
            >
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
            </select>
            <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
              </svg>
              {importing ? 'Importing…' : 'Import CSV'}
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
            </label>
          </div>
          <p className="text-xs text-gray-400">CSV: one keyword per line (no header required)</p>
        </div>
      </div>

      {/* Ban list */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm text-gray-500">
              {bannedTotal !== null ? (
                <><span className="font-medium text-gray-700">{bannedTotal.toLocaleString()} keyword{bannedTotal !== 1 ? 's' : ''}</span> {bannedTotal === 1 ? 'is' : 'are'} currently not eligible to be added for legal and compliance reasons.</>
              ) : (
                <span className="animate-pulse">Loading eligibility list…</span>
              )}
            </p>
          </div>
          <button
            onClick={toggleBanned}
            className="shrink-0 text-xs text-brand-600 hover:underline"
          >
            {showBanned ? 'Hide' : 'Show'}
          </button>
        </div>

        {showBanned && (
          <div className="mt-3">
            {bannedLoading && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
            {!bannedLoading && bannedList && bannedList.length > 0 && (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-gray-400">Read-only — these terms will be silently skipped on add or import.</p>
                  <button
                    onClick={copyBannedList}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {copiedBanned ? 'Copied!' : 'Copy all'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 rounded border border-gray-100 bg-gray-50 p-3">
                  {bannedList.map(term => (
                    <span key={term} className="rounded bg-white px-2 py-0.5 text-xs text-gray-500 border border-gray-200 font-mono">
                      {term}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Audit log */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Audit log</p>
          <div className="flex items-center gap-3">
            {showAudit && (
              <a
                href={`/api/app-keywords?appId=${appId}&sub=audit-log&format=csv`}
                download="keyword-audit-log.csv"
                className="text-xs text-brand-600 hover:underline"
              >
                Download CSV
              </a>
            )}
            <button
              onClick={() => {
                setShowAudit(v => !v);
                if (!showAudit) setAuditLog(null);
              }}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              {showAudit ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {showAudit && (
          <div className="mt-3">
            {auditLoading && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
            {!auditLoading && auditLog !== null && auditLog.length === 0 && (
              <p className="text-xs text-gray-400">No changes recorded yet.</p>
            )}
            {!auditLoading && auditLog && auditLog.length > 0 && (
              <div className="overflow-hidden rounded border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Keyword</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Action</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">By</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((e, i) => (
                      <tr key={e.id} className={i !== auditLog.length - 1 ? 'border-b border-gray-100' : ''}>
                        <td className="px-3 py-2 font-medium text-gray-800">{e.keyword}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${e.action === 'added' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {e.action}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 capitalize">{e.type}</td>
                        <td className="px-3 py-2 text-gray-500">{e.changedByEmail}</td>
                        <td className="px-3 py-2 font-mono text-gray-400">
                          {new Date(e.changedAt).toISOString().replace('T', ' ').slice(0, 16)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
