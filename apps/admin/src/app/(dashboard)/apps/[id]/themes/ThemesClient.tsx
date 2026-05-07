'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Theme } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type StatusFilter = 'all' | 'pending' | 'accepted' | 'discarded';

interface CostEstimate {
  needsConfirmation: true;
  estimatedCostUsd: number;
  reviewCount: number;
  filteredCount: number;
  sourceHash: string;
}

interface Props {
  appId: string;
  initialThemes: Theme[];
}

export function ThemesClient({ appId, initialThemes }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Paste + analyze flow
  const [reviewText, setReviewText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [analyzeSuccess, setAnalyzeSuccess] = useState('');

  // Theme list
  const [themes, setThemes] = useState<Theme[]>(initialThemes);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Inline label editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  // Store config
  const [appStoreUrl, setAppStoreUrl] = useState('');
  const [playStoreUrl, setPlayStoreUrl] = useState('');
  const [savingStore, setSavingStore] = useState(false);
  const [storeMsg, setStoreMsg] = useState('');

  async function handleAnalyze() {
    if (!reviewText.trim()) return;
    setAnalyzing(true);
    setAnalyzeError('');
    setEstimate(null);
    setAnalyzeSuccess('');
    try {
      const res = await fetch('/api/app-themes-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, text: reviewText }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'no_llm_provider') {
          setAnalyzeError('no_provider');
        } else if (data.error === 'no_reviews_after_filter') {
          setAnalyzeError(`No 4★+ reviews found in ${data.reviewCount} parsed reviews. Add star ratings (e.g. "5★") or paste only positive reviews.`);
        } else if (data.error === 'rate_limit_exceeded') {
          setAnalyzeError(`Daily rate limit reached (${data.limit} analyses/day). Try again tomorrow.`);
        } else {
          setAnalyzeError(data.message ?? data.error ?? 'Analysis failed');
        }
        return;
      }
      if (data.cached) {
        // Cached result — update themes list directly
        setThemes(data.themes);
        setAnalyzeSuccess(`Loaded from cache (${data.filteredCount} of ${data.reviewCount} reviews). Themes shown below.`);
        return;
      }
      if (data.needsConfirmation) {
        setEstimate(data as CostEstimate);
        return;
      }
      // Direct result (shouldn't happen without confirm, but handle)
      setThemes(prev => [...data.themes, ...prev]);
      setAnalyzeSuccess(`Extracted ${data.themes.length} themes from ${data.filteredCount} of ${data.reviewCount} reviews.`);
      startTransition(() => router.refresh());
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirm() {
    if (!estimate) return;
    setConfirming(true);
    setAnalyzeError('');
    try {
      const res = await fetch('/api/app-themes-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, text: reviewText, confirmed: true, sourceHash: estimate.sourceHash }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.message ?? data.error ?? 'LLM error');
        return;
      }
      setEstimate(null);
      setThemes(prev => [...data.themes, ...prev]);
      setAnalyzeSuccess(`Extracted ${data.themes.length} themes from ${data.filteredCount} of ${data.reviewCount} reviews. Cost: $${data.actualCostUsd?.toFixed(4) ?? '?'}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setConfirming(false);
    }
  }

  async function handleAction(themeId: string, action: 'accept' | 'discard') {
    const res = await fetch('/api/app-themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, themeId, action }),
    });
    if (res.ok) {
      const data = await res.json();
      setThemes(prev => prev.map(t => t.id === themeId ? data.theme : t));
    }
  }

  async function handleSaveLabel(themeId: string) {
    const res = await fetch('/api/app-themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, themeId, action: 'patch-label', label: editLabel }),
    });
    if (res.ok) {
      const data = await res.json();
      setThemes(prev => prev.map(t => t.id === themeId ? data.theme : t));
    }
    setEditingId(null);
  }

  async function handleSaveStoreConfig() {
    setSavingStore(true);
    setStoreMsg('');
    try {
      const res = await fetch('/api/app-store-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, appStoreUrl: appStoreUrl || null, playStoreUrl: playStoreUrl || null }),
      });
      if (res.ok) {
        setStoreMsg('Store URLs saved.');
      } else {
        setStoreMsg('Failed to save.');
      }
    } catch {
      setStoreMsg('Network error.');
    } finally {
      setSavingStore(false);
    }
  }

  const filtered = themes.filter(t => {
    if (statusFilter === 'all') return t.status !== 'discarded';
    return t.status === statusFilter;
  });

  const statusTabs: StatusFilter[] = ['all', 'pending', 'accepted', 'discarded'];
  const counts: Record<StatusFilter, number> = {
    all: themes.filter(t => t.status !== 'discarded').length,
    pending: themes.filter(t => t.status === 'pending').length,
    accepted: themes.filter(t => t.status === 'accepted').length,
    discarded: themes.filter(t => t.status === 'discarded').length,
  };

  return (
    <div className="space-y-8">

      {/* Paste + Analyze */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <Label className="text-base font-semibold">Paste app store reviews</Label>
          <p className="text-xs text-gray-500 mt-0.5">
            Paste raw reviews from the App Store or Google Play. Include star ratings (e.g. "5★ Great app!") for best results — only 4★+ reviews are analyzed.
          </p>
        </div>
        <Textarea
          rows={8}
          placeholder={"5★ The offline mode is a game changer!\n4★ Clean UI and fast sync.\n3★ Needs dark mode.\n..."}
          value={reviewText}
          onChange={e => setReviewText(e.target.value)}
          className="font-mono text-xs"
        />

        {analyzeError === 'no_provider' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No LLM provider configured.{' '}
            <a href="../llm-config" className="font-medium underline">Set one up</a> before analyzing.
          </div>
        )}
        {analyzeError && analyzeError !== 'no_provider' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{analyzeError}</div>
        )}
        {analyzeSuccess && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{analyzeSuccess}</div>
        )}

        {/* Cost estimate confirmation */}
        {estimate && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-brand-800">Confirm analysis</p>
            <div className="text-sm text-brand-700 space-y-1">
              <div className="flex justify-between"><span>Reviews parsed</span><strong>{estimate.reviewCount}</strong></div>
              <div className="flex justify-between"><span>4★+ reviews to analyze</span><strong>{estimate.filteredCount}</strong></div>
              <div className="flex justify-between"><span>Estimated cost</span><strong>${estimate.estimatedCostUsd.toFixed(4)}</strong></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleConfirm} disabled={confirming} size="sm">
                {confirming ? 'Analyzing…' : 'Confirm & analyze'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEstimate(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {!estimate && (
          <Button onClick={handleAnalyze} disabled={analyzing || !reviewText.trim()}>
            {analyzing ? 'Analyzing…' : 'Analyze reviews'}
          </Button>
        )}
      </div>

      {/* Theme list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Themes</h2>
          <div className="flex gap-1">
            {statusTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === tab
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab === 'all' ? 'Active' : tab.charAt(0).toUpperCase() + tab.slice(1)} ({counts[tab]})
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-12 text-center">
            <p className="font-semibold text-gray-900">No themes yet</p>
            <p className="mt-1 text-sm text-gray-500">Paste reviews above and click Analyze to extract themes.</p>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map(theme => (
            <div
              key={theme.id}
              className={`rounded-lg border bg-white p-4 ${
                theme.status === 'accepted' ? 'border-green-300' :
                theme.status === 'discarded' ? 'border-gray-100 opacity-60' :
                'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {editingId === theme.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveLabel(theme.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <Button size="sm" onClick={() => handleSaveLabel(theme.id)}>Save</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{theme.label}</span>
                      <Badge variant={theme.status === 'accepted' ? 'default' : theme.status === 'discarded' ? 'destructive' : 'secondary'}>
                        {theme.status}
                      </Badge>
                      <span className="text-xs text-gray-400">×{theme.frequency}</span>
                      <button
                        onClick={() => { setEditingId(theme.id); setEditLabel(theme.label); }}
                        className="text-xs text-gray-400 hover:text-gray-600 ml-1"
                        title="Edit label"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                  {theme.examplePhrases.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500 italic">
                      "{theme.examplePhrases[0]}"
                      {theme.examplePhrases[1] && <>, "{theme.examplePhrases[1]}"</>}
                    </p>
                  )}
                </div>
                {theme.status !== 'discarded' && editingId !== theme.id && (
                  <div className="flex shrink-0 gap-2">
                    {theme.status !== 'accepted' && (
                      <Button size="sm" onClick={() => handleAction(theme.id, 'accept')}>Accept</Button>
                    )}
                    {theme.status === 'accepted' && (
                      <Button size="sm" variant="secondary" onClick={() => handleAction(theme.id, 'discard')}>Revoke</Button>
                    )}
                    {theme.status === 'pending' && (
                      <Button size="sm" variant="secondary" onClick={() => handleAction(theme.id, 'discard')}>Discard</Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Store URLs (for future auto-refresh, M9) */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <p className="text-base font-semibold text-gray-900">Store URLs</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Optional — reserved for automatic review fetching in a future update.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>App Store URL</Label>
            <Input
              placeholder="https://apps.apple.com/app/..."
              value={appStoreUrl}
              onChange={e => setAppStoreUrl(e.target.value)}
            />
          </div>
          <div>
            <Label>Google Play URL</Label>
            <Input
              placeholder="https://play.google.com/store/apps/..."
              value={playStoreUrl}
              onChange={e => setPlayStoreUrl(e.target.value)}
            />
          </div>
        </div>
        {storeMsg && <p className="text-sm text-gray-600">{storeMsg}</p>}
        <Button variant="secondary" onClick={handleSaveStoreConfig} disabled={savingStore}>
          {savingStore ? 'Saving…' : 'Save store URLs'}
        </Button>
      </div>
    </div>
  );
}
