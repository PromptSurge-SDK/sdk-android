'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  appId: string;
  appName: string;
  /** Show as an icon-only button (for card use) or a full labelled button. */
  variant?: 'icon' | 'full';
  /** If provided, navigate here after a successful immediate delete. */
  redirectAfterDelete?: string;
}

export function DeleteAppButton({
  appId,
  appName,
  variant = 'full',
  redirectAfterDelete,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch('/api/delete-app', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? 'Failed to delete app');
      }
      const result = await res.json() as { immediate: boolean };
      setOpen(false);
      if (result.immediate) {
        toast.success(`${appName} deleted.`);
        if (redirectAfterDelete) {
          router.push(redirectAfterDelete);
        } else {
          router.refresh();
        }
      } else {
        toast.success(`${appName} moved to discarded. You can restore it any time.`);
        router.refresh();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete app');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
          title={`Delete ${appName}`}
          aria-label={`Delete ${appName}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete app
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{appName}"?</DialogTitle>
            <DialogDescription>
              If this app has never received any events it will be permanently deleted.
              Otherwise it moves to the discarded section where you can restore it for up
              to 90 days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              isLoading={loading}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
