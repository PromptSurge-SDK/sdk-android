'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Keyword } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

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
  const [error, setError] = useState('');

  const positive = keywords.filter(k => k.type === 'positive');
  const negative = keywords.filter(k => k.type === 'negative');

  async function handleAdd() {
    if (!newText.trim()) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch('/api/app-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, text: newText.trim(), type: newType }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      setNewText('');
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(keywordId: string) {
    await fetch('/api/app-keywords', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, keywordId }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      {/* Add keyword */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-gray-700">Add keyword</p>
        <div className="flex items-center gap-2">
          <Input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="e.g. graphics, performance, easy to use…"
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
      </div>

      {/* Keyword lists */}
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

      {keywords.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-12 text-center">
          <p className="font-semibold text-gray-900">No keywords yet</p>
          <p className="mt-1 text-sm text-gray-500">Add positive keywords to steer AI-generated prompts, or negative ones to exclude topics.</p>
        </div>
      )}
    </div>
  );
}
