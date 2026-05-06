'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Copy, CheckCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { createApp } from '@/lib/api';

const schema = z.object({ name: z.string().min(1, 'App name is required').max(80) });
type FormData = z.infer<typeof schema>;

type Step = 'form' | 'reveal';

export function CreateAppButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [apiKey, setApiKey] = useState('');
  const [appName, setAppName] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function openModal() {
    reset();
    setStep('form');
    setApiKey('');
    setCopied(false);
    setConfirmed(false);
    setOpen(true);
  }

  async function onSubmit(data: FormData) {
    try {
      const res = await fetch('/api/create-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to create app');
      }
      const result = await res.json();
      setApiKey(result.apiKey.key);
      setAppName(data.name);
      setStep('reveal');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create app');
    }
  }

  async function copyKey() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function finish() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button onClick={openModal} data-testid="create-app-btn">
        + Create app
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v && step === 'reveal' && !confirmed) return; setOpen(v); }}>
        <DialogContent>
          {step === 'form' ? (
            <>
              <DialogHeader>
                <DialogTitle>Create a new app</DialogTitle>
                <DialogDescription>Give your app a name to identify it in the dashboard.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="create-app-form">
                <div className="space-y-1">
                  <Label htmlFor="app-name">App name</Label>
                  <Input
                    id="app-name"
                    placeholder="My awesome app"
                    autoFocus
                    {...register('name')}
                  />
                  {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={isSubmitting}>
                    Create app
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>App created: {appName}</DialogTitle>
                <DialogDescription>
                  Save your API key now. It{'’'}s shown{' '}
                  <span className="font-semibold text-gray-900">only once</span> and cannot be
                  retrieved later.
                </DialogDescription>
              </DialogHeader>

              {/* Key reveal — unmistakable */}
              <div className="mt-2 rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Copy this key now — you won{'’'}t be able to see it again
                </div>
                <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2">
                  <code
                    className="flex-1 break-all font-mono text-sm text-gray-900 select-all"
                    data-testid="api-key-value"
                  >
                    {apiKey}
                  </code>
                  <button
                    onClick={copyKey}
                    className="ml-2 flex-shrink-0 rounded p-1 hover:bg-amber-100"
                    title="Copy to clipboard"
                    data-testid="copy-key-btn"
                  >
                    {copied ? (
                      <CheckCheck className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-amber-700" />
                    )}
                  </button>
                </div>
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-brand-600"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  data-testid="saved-key-checkbox"
                />
                <span className="text-sm text-gray-700">
                  I have copied and saved my API key in a secure location.
                </span>
              </label>

              <DialogFooter>
                <Button
                  onClick={finish}
                  disabled={!confirmed}
                  data-testid="done-btn"
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
