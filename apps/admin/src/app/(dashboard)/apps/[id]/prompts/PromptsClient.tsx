'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PromptText, GeneratedPromptCandidate, GenerateInfluences } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  draft: 'secondary',
  discarded: 'destructive',
};

const LOCALES = ['en', 'de', 'es', 'fr', 'ja', 'pt', 'it', 'nl', 'ko', 'zh'];

interface Props {
  appId: string;
  prompts: PromptText[];
  hasLlmConfig: boolean;
}

export function PromptsClient({ appId, prompts, hasLlmConfig }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Add prompt dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ locale: 'en', title: '', body: '', ctaConfirm: 'Sure', ctaDismiss: 'Not now' });
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Generate flow
  const [genLocale, setGenLocale] = useState('en');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [candidates, setCandidates] = useState<GeneratedPromptCandidate[]>([]);
  const [genInfluences, setGenInfluences] = useState<GenerateInfluences | null>(null);
  const [acceptedIdxs, setAcceptedIdxs] = useState<Set<number>>(new Set());
  const [discardedIdxs, setDiscardedIdxs] = useState<Set<number>>(new Set());

  async function handleAddPrompt() {
    setAddSaving(true);
    setAddError('');
    try {
      const res = await fetch('/api/app-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, ...addForm }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setAddOpen(false);
      setAddForm({ locale: 'en', title: '', body: '', ctaConfirm: 'Sure', ctaDismiss: 'Not now' });
      startTransition(() => router.refresh());
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setAddSaving(false);
    }
  }

  async function handleStatusChange(promptId: string, status: 'active' | 'discarded') {
    await fetch('/api/app-prompts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, promptId, status }),
    });
    startTransition(() => router.refresh());
  }

  async function handleDelete(promptId: string) {
    if (!confirm('Delete this prompt text?')) return;
    await fetch('/api/app-prompts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, promptId }),
    });
    startTransition(() => router.refresh());
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenError('');
    setCandidates([]);
    setGenInfluences(null);
    setAcceptedIdxs(new Set());
    setDiscardedIdxs(new Set());
    try {
      const res = await fetch('/api/app-generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, locale: genLocale, count: 3 }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'no_llm_provider') {
          setGenError('no_provider');
        } else {
          setGenError(data.message ?? data.error ?? 'Generation failed');
        }
        return;
      }
      setCandidates(data.prompts ?? []);
      setGenInfluences(data.influences ?? null);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAcceptCandidate(idx: number, candidate: GeneratedPromptCandidate) {
    const res = await fetch('/api/app-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId,
        locale: genLocale,
        title: candidate.title,
        body: candidate.body,
        ctaConfirm: candidate.ctaConfirm,
        ctaDismiss: candidate.ctaDismiss,
        status: 'active',
        generatedByLlm: true,
      }),
    });
    if (res.ok) {
      setAcceptedIdxs(prev => new Set(prev).add(idx));
      startTransition(() => router.refresh());
    }
  }

  // Group prompts by locale
  const byLocale: Record<string, PromptText[]> = {};
  for (const p of prompts) {
    (byLocale[p.locale] ??= []).push(p);
  }

  return (
    <div className="space-y-8">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setAddOpen(true)}>Add prompt text</Button>

        <div className="flex items-center gap-2">
          <Select
            value={genLocale}
            onChange={e => setGenLocale(e.target.value)}
            className="w-28"
          >
            {LOCALES.map(l => <option key={l} value={l}>{l}</option>)}
          </Select>
          <Button
            variant="secondary"
            onClick={handleGenerate}
            disabled={!hasLlmConfig || generating}
          >
            {generating ? 'Generating…' : 'Generate from keywords'}
          </Button>
          {!hasLlmConfig && (
            <span className="text-sm text-gray-500">
              <a href="llm-config" className="text-brand-600 hover:underline">Configure LLM provider</a> first
            </span>
          )}
        </div>
      </div>

      {/* Generate candidates */}
      {genError === 'no_provider' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No LLM provider configured.{' '}
          <a href="llm-config" className="font-medium underline">Set one up here</a> before generating.
        </div>
      )}
      {genError && genError !== 'no_provider' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{genError}</div>
      )}

      {candidates.length > 0 && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 space-y-4">
          <p className="text-sm font-medium text-brand-800">
            Generated {candidates.length} candidates for locale <strong>{genLocale}</strong> — accept any to save:
          </p>
          {genInfluences && (genInfluences.keywords.length > 0 || genInfluences.themes.length > 0) && (
            <div className="text-xs text-brand-600 space-y-0.5">
              {genInfluences.keywords.length > 0 && (
                <p>Keywords: {genInfluences.keywords.join(', ')}</p>
              )}
              {genInfluences.themes.length > 0 && (
                <p>Themes: {genInfluences.themes.join(', ')}</p>
              )}
            </div>
          )}
          <div className="space-y-3">
            {candidates.map((c, idx) => {
              const accepted = acceptedIdxs.has(idx);
              const discarded = discardedIdxs.has(idx);
              if (discarded) return null;
              return (
                <div key={idx} className={`rounded-lg border bg-white p-4 ${accepted ? 'border-green-300' : 'border-gray-200'}`}>
                  <div className="mb-2 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{c.title}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{c.body}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        "{c.ctaConfirm}" / "{c.ctaDismiss}"
                      </p>
                    </div>
                    {!accepted && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" onClick={() => handleAcceptCandidate(idx, c)}>Accept</Button>
                        <Button size="sm" variant="secondary" onClick={() => setDiscardedIdxs(prev => new Set(prev).add(idx))}>
                          Discard
                        </Button>
                      </div>
                    )}
                    {accepted && <Badge variant="default">Saved</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Existing prompts grouped by locale */}
      {Object.keys(byLocale).length === 0 && candidates.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="font-semibold text-gray-900">No prompt texts yet</p>
          <p className="mt-1 text-sm text-gray-500">Add one manually or generate from keywords above.</p>
        </div>
      )}

      {Object.entries(byLocale).map(([locale, items]) => (
        <div key={locale}>
          <h3 className="mb-2 font-semibold text-gray-700 text-sm uppercase tracking-wide">{locale}</h3>
          <div className="space-y-2">
            {items.map(p => (
              <div key={p.id} className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={STATUS_COLORS[p.status] ?? 'secondary'}>{p.status}</Badge>
                    {p.generatedByLlm && <span className="text-xs text-gray-400">AI-generated</span>}
                  </div>
                  <p className="font-medium text-gray-900 truncate">{p.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5 truncate">{p.body}</p>
                  <p className="text-xs text-gray-400 mt-1">"{p.ctaConfirm}" / "{p.ctaDismiss}"</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {p.status !== 'active' && (
                    <Button size="sm" onClick={() => handleStatusChange(p.id, 'active')}>Activate</Button>
                  )}
                  {p.status === 'active' && (
                    <Button size="sm" variant="secondary" onClick={() => handleStatusChange(p.id, 'discarded')}>
                      Deactivate
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(p.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add prompt dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add prompt text</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Locale</Label>
              <Select value={addForm.locale} onChange={e => setAddForm(f => ({ ...f, locale: e.target.value }))}>
                {LOCALES.map(l => <option key={l} value={l}>{l}</option>)}
              </Select>
            </div>
            <div>
              <Label>Title <span className="text-gray-400 text-xs">(≤ 40 chars)</span></Label>
              <Input maxLength={80} value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} placeholder="Quick favor?" />
            </div>
            <div>
              <Label>Body <span className="text-gray-400 text-xs">(≤ 120 chars)</span></Label>
              <Textarea rows={3} maxLength={300} value={addForm.body} onChange={e => setAddForm(f => ({ ...f, body: e.target.value }))} placeholder="Reviews help other people find apps like this." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Confirm button</Label>
                <Input maxLength={30} value={addForm.ctaConfirm} onChange={e => setAddForm(f => ({ ...f, ctaConfirm: e.target.value }))} placeholder="Sure" />
              </div>
              <div>
                <Label>Dismiss button</Label>
                <Input maxLength={30} value={addForm.ctaDismiss} onChange={e => setAddForm(f => ({ ...f, ctaDismiss: e.target.value }))} placeholder="Not now" />
              </div>
            </div>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddPrompt} disabled={addSaving || !addForm.title || !addForm.body}>
                {addSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
