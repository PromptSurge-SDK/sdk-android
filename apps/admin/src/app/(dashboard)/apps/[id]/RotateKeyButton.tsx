'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Copy, CheckCheck, AlertTriangle } from 'lucide-react';

interface Props {
  appId: string;
}

export function RotateKeyButton({ appId }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function doRotate() {
    setRotating(true);
    try {
      const res = await fetch(`/api/rotate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Rotation failed');
      }
      const data = await res.json();
      setNewKey(data.apiKey.key);
      setConfirming(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Rotation failed');
      setConfirming(false);
    } finally {
      setRotating(false);
    }
  }

  async function copyKey() {
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function finish() {
    setNewKey('');
    setSaved(false);
    router.refresh();
  }

  if (newKey) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            New key — copy it now
          </div>
          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-white px-2 py-1.5">
            <code className="flex-1 break-all font-mono text-xs text-gray-900 select-all" data-testid="rotated-key-value">
              {newKey}
            </code>
            <button onClick={copyKey} className="flex-shrink-0 rounded p-0.5 hover:bg-amber-100">
              {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-amber-700" />}
            </button>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 h-3.5 w-3.5 accent-brand-600"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
          />
          <span className="text-xs text-gray-700">I've saved the new key.</span>
        </label>
        <Button size="sm" disabled={!saved} onClick={finish}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
        data-testid="rotate-key-btn"
      >
        Rotate key
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate API key?</DialogTitle>
            <DialogDescription>
              A new key will be issued. Your existing key stays valid for 7 days so you can
              update your app without downtime. After that, the old key is rejected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="destructive" isLoading={rotating} onClick={doRotate}>
              Rotate key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
