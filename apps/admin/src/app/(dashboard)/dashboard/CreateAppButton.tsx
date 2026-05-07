'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Copy, CheckCheck, AlertTriangle, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import Image from 'next/image';

const schema = z.object({
  name: z.string().min(1, 'App name is required').max(120),
  playStoreUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  appStoreUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

type Step = 'form' | 'reveal';

interface StoreMeta {
  storeIconUrl?: string;
  publisherName?: string;
  playRating?: number;
  appStoreRating?: number;
  playReviewCount?: number;
  appStoreReviewCount?: number;
}

interface StoreMetaResult {
  platform: 'play' | 'appstore';
  name: string;
  icon: string | null;
  publisher: string | null;
  rating: number | null;
  reviewCount: number | null;
  error?: string;
}

function isValidStoreUrl(url: string, platform: 'play' | 'appstore'): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (platform === 'play') return parsed.hostname === 'play.google.com';
    return (
      parsed.hostname === 'apps.apple.com' || parsed.hostname === 'itunes.apple.com'
    );
  } catch {
    return false;
  }
}

async function fetchStoreMeta(url: string): Promise<StoreMetaResult | null> {
  try {
    const res = await fetch(`/api/store-meta?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    return (await res.json()) as StoreMetaResult;
  } catch {
    return null;
  }
}

function MetaChip({
  meta,
  platform,
}: {
  meta: StoreMetaResult;
  platform: 'play' | 'appstore';
}) {
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
      {meta.icon ? (
        <Image
          src={meta.icon}
          alt={meta.name}
          width={24}
          height={24}
          className="h-6 w-6 rounded-md object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-white">
          {meta.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="truncate font-medium text-gray-900">{meta.name}</span>
        {meta.publisher && (
          <span className="ml-1.5 text-gray-500">&bull; {meta.publisher}</span>
        )}
      </div>
      {meta.rating != null && (
        <span className="flex items-center gap-0.5 text-xs text-amber-600">
          <Star className="h-3 w-3 fill-current" />
          {meta.rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

function CombinedPreview({
  playMeta,
  appStoreMeta,
  name,
}: {
  playMeta: StoreMetaResult | null;
  appStoreMeta: StoreMetaResult | null;
  name: string;
}) {
  const icon = appStoreMeta?.icon ?? playMeta?.icon ?? null;
  const publisher = appStoreMeta?.publisher ?? playMeta?.publisher ?? null;
  const displayName = name || appStoreMeta?.name || playMeta?.name || 'Your app';

  return (
    <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">Preview</div>
      <div className="flex items-center gap-3">
        {icon ? (
          <Image
            src={icon}
            alt={displayName}
            width={48}
            height={48}
            className="h-12 w-12 rounded-xl object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 text-xl font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-gray-900">{displayName}</div>
          {publisher && <div className="truncate text-sm text-gray-500">{publisher}</div>}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {playMeta?.rating != null && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="text-green-600">▶</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="font-medium text-gray-700">{playMeta.rating.toFixed(1)}</span>
                {playMeta.reviewCount != null && (
                  <span className="text-gray-400">({playMeta.reviewCount.toLocaleString()})</span>
                )}
              </span>
            )}
            {appStoreMeta?.rating != null && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="text-blue-500"></span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="font-medium text-gray-700">{appStoreMeta.rating.toFixed(1)}</span>
                {appStoreMeta.reviewCount != null && (
                  <span className="text-gray-400">({appStoreMeta.reviewCount.toLocaleString()})</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreateAppButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [apiKey, setApiKey] = useState('');
  const [appName, setAppName] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Store meta state
  const [playMeta, setPlayMeta] = useState<StoreMetaResult | null>(null);
  const [appStoreMeta, setAppStoreMeta] = useState<StoreMetaResult | null>(null);
  const [playLoading, setPlayLoading] = useState(false);
  const [appStoreLoading, setAppStoreLoading] = useState(false);
  const [autoFilledName, setAutoFilledName] = useState(false);

  const playDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const watchedName = watch('name', '');

  function openModal() {
    reset();
    setStep('form');
    setApiKey('');
    setCopied(false);
    setConfirmed(false);
    setPlayMeta(null);
    setAppStoreMeta(null);
    setAutoFilledName(false);
    setOpen(true);
  }

  const handlePlayUrlChange = useCallback(
    (url: string) => {
      if (playDebounceRef.current) clearTimeout(playDebounceRef.current);
      if (!isValidStoreUrl(url, 'play')) {
        setPlayMeta(null);
        return;
      }
      playDebounceRef.current = setTimeout(async () => {
        setPlayLoading(true);
        try {
          const meta = await fetchStoreMeta(url);
          setPlayMeta(meta);
          if (meta && !meta.error && (!watchedName || autoFilledName)) {
            setValue('name', meta.name, { shouldValidate: true });
            setAutoFilledName(true);
          }
        } finally {
          setPlayLoading(false);
        }
      }, 600);
    },
    [watchedName, autoFilledName, setValue],
  );

  const handleAppStoreUrlChange = useCallback(
    (url: string) => {
      if (appStoreDebounceRef.current) clearTimeout(appStoreDebounceRef.current);
      if (!isValidStoreUrl(url, 'appstore')) {
        setAppStoreMeta(null);
        return;
      }
      appStoreDebounceRef.current = setTimeout(async () => {
        setAppStoreLoading(true);
        try {
          const meta = await fetchStoreMeta(url);
          setAppStoreMeta(meta);
          if (meta && !meta.error && (!watchedName || autoFilledName)) {
            setValue('name', meta.name, { shouldValidate: true });
            setAutoFilledName(true);
          }
        } finally {
          setAppStoreLoading(false);
        }
      }, 600);
    },
    [watchedName, autoFilledName, setValue],
  );

  async function onSubmit(data: FormData) {
    try {
      // Build combined store meta from fetched results
      const storeMeta: StoreMeta = {};
      const icon = appStoreMeta?.icon ?? playMeta?.icon ?? null;
      if (icon) storeMeta.storeIconUrl = icon;
      const publisher = appStoreMeta?.publisher ?? playMeta?.publisher ?? null;
      if (publisher) storeMeta.publisherName = publisher;
      if (playMeta?.rating != null) storeMeta.playRating = playMeta.rating;
      if (appStoreMeta?.rating != null) storeMeta.appStoreRating = appStoreMeta.rating;
      if (playMeta?.reviewCount != null) storeMeta.playReviewCount = playMeta.reviewCount;
      if (appStoreMeta?.reviewCount != null) storeMeta.appStoreReviewCount = appStoreMeta.reviewCount;

      const payload: {
        name: string;
        playStoreUrl?: string;
        appStoreUrl?: string;
        storeMeta?: StoreMeta;
      } = { name: data.name };

      if (data.playStoreUrl) payload.playStoreUrl = data.playStoreUrl;
      if (data.appStoreUrl) payload.appStoreUrl = data.appStoreUrl;
      if (Object.keys(storeMeta).length > 0) payload.storeMeta = storeMeta;

      const res = await fetch('/api/create-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? 'Failed to create app');
      }
      const result = await res.json() as { apiKey: { key: string } };
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

  const showPreview = !!(playMeta || appStoreMeta);

  return (
    <>
      <Button onClick={openModal} data-testid="create-app-btn">
        + Create app
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && step === 'reveal' && !confirmed) return;
          setOpen(v);
        }}
      >
        <DialogContent className="max-w-lg">
          {step === 'form' ? (
            <>
              <DialogHeader>
                <DialogTitle>Create a new app</DialogTitle>
                <DialogDescription>
                  Add store URLs to automatically pull in your app icon, ratings, and publisher info.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="create-app-form">
                {/* URL fields */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="play-store-url">Google Play URL</Label>
                    <div className="relative">
                      <Input
                        id="play-store-url"
                        placeholder="https://play.google.com/store/apps/details?id=com.example.app"
                        {...register('playStoreUrl', {
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                            handlePlayUrlChange(e.target.value),
                        })}
                        onBlur={(e) => handlePlayUrlChange(e.target.value)}
                      />
                      {playLoading && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </span>
                      )}
                    </div>
                    {errors.playStoreUrl && (
                      <p className="text-xs text-red-600">{errors.playStoreUrl.message}</p>
                    )}
                    {playMeta && !playMeta.error && <MetaChip meta={playMeta} platform="play" />}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="app-store-url">Apple App Store URL</Label>
                    <div className="relative">
                      <Input
                        id="app-store-url"
                        placeholder="https://apps.apple.com/app/name/id123456789"
                        {...register('appStoreUrl', {
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                            handleAppStoreUrlChange(e.target.value),
                        })}
                        onBlur={(e) => handleAppStoreUrlChange(e.target.value)}
                      />
                      {appStoreLoading && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </span>
                      )}
                    </div>
                    {errors.appStoreUrl && (
                      <p className="text-xs text-red-600">{errors.appStoreUrl.message}</p>
                    )}
                    {appStoreMeta && !appStoreMeta.error && (
                      <MetaChip meta={appStoreMeta} platform="appstore" />
                    )}
                  </div>
                </div>

                {/* Combined preview */}
                {showPreview && (
                  <CombinedPreview
                    playMeta={playMeta}
                    appStoreMeta={appStoreMeta}
                    name={watchedName}
                  />
                )}

                {/* App name */}
                <div className="space-y-1">
                  <Label htmlFor="app-name">App name</Label>
                  <Input
                    id="app-name"
                    placeholder="My awesome app"
                    autoFocus={!showPreview}
                    {...register('name', {
                      onChange: () => setAutoFilledName(false),
                    })}
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
                  Save your API key now. It&apos;s shown{' '}
                  <span className="font-semibold text-gray-900">only once</span> and cannot be
                  retrieved later.
                </DialogDescription>
              </DialogHeader>

              {/* Key reveal — unmistakable */}
              <div className="mt-2 rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Copy this key now — you won&apos;t be able to see it again
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
                <Button onClick={finish} disabled={!confirmed} data-testid="done-btn">
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
