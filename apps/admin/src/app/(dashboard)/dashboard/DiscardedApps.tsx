'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { AppSummary } from '@/lib/api';

function AppIconSmall({ app }: { app: AppSummary }) {
  if (app.storeIconUrl) {
    return (
      <Image
        src={app.storeIconUrl}
        alt={`${app.name} icon`}
        width={40}
        height={40}
        className="h-10 w-10 flex-shrink-0 rounded-xl object-cover grayscale opacity-60"
        unoptimized
      />
    );
  }
  const letter = app.name.charAt(0).toUpperCase();
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-200 text-lg font-bold text-gray-400">
      {letter}
    </div>
  );
}

function days(ms: number) {
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function RestoreButton({ app }: { app: AppSummary }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRestore() {
    setLoading(true);
    try {
      const res = await fetch('/api/restore-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: app.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? 'Failed to restore app');
      }
      toast.success(`${app.name} restored.`);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to restore app');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleRestore} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
      <span className="ml-1.5">Restore</span>
    </Button>
  );
}

function PermanentDeleteButton({ app }: { app: AppSummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handlePermanentDelete() {
    setLoading(true);
    try {
      const res = await fetch('/api/permanent-delete-app', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: app.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? 'Failed to permanently delete app');
      }
      setOpen(false);
      toast.success(`${app.name} permanently deleted.`);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to permanently delete app');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="ml-1.5">Delete forever</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Permanently delete "{app.name}"?</DialogTitle>
            <DialogDescription>
              This will delete the app and all its event history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handlePermanentDelete} isLoading={loading}>
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DiscardedCard({ app }: { app: AppSummary }) {
  const deletedMs = app.deletedAt ? Date.now() - new Date(app.deletedAt).getTime() : 0;
  const daysDeleted = days(deletedMs);
  const daysLeft = Math.max(0, 90 - daysDeleted);

  // Determine what's keeping this app restorable
  let restorationReason: string;
  if (app.sdkActive) {
    restorationReason = 'SDK still active';
  } else if (!app.purgeable) {
    if (daysLeft > 0) {
      restorationReason = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left to restore`;
    } else {
      restorationReason = 'Protected by subscription';
    }
  } else {
    restorationReason = 'Ready to permanently delete';
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <AppIconSmall app={app} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-500">{app.name}</div>
        <div className="mt-0.5 text-xs text-gray-400">
          {app.publisherName && <span>{app.publisherName} · </span>}
          {restorationReason}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <RestoreButton app={app} />
        {app.purgeable && <PermanentDeleteButton app={app} />}
      </div>
    </div>
  );
}

interface Props {
  apps: AppSummary[];
}

export function DiscardedApps({ apps }: Props) {
  if (apps.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-500">Discarded</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
          {apps.length}
        </span>
      </div>
      <div className="space-y-2">
        {apps.map((app) => (
          <DiscardedCard key={app.id} app={app} />
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Discarded apps are restorable for 90 days. Apps with active SDK traffic or a paid subscription are always restorable.
      </p>
    </div>
  );
}
