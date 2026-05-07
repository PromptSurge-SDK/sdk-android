export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import type { StoreMetaResult } from '../store-meta/route';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

interface RefreshBody {
  appId: string;
  playStoreUrl?: string;
  appStoreUrl?: string;
}

interface CombinedStoreMeta {
  storeIconUrl?: string;
  publisherName?: string;
  playRating?: number;
  appStoreRating?: number;
  playReviewCount?: number;
  appStoreReviewCount?: number;
}

async function fetchStoreMeta(url: string): Promise<StoreMetaResult | null> {
  try {
    // Build internal URL for the store-meta handler
    const encoded = encodeURIComponent(url);

    let platformResult: StoreMetaResult | null = null;

    if (url.includes('play.google.com')) {
      const parsed = new URL(url);
      const packageId = parsed.searchParams.get('id');
      if (!packageId) return null;

      const resp = await fetch(
        `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageId)}&hl=en&gl=US`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!resp.ok) return null;

      const html = await resp.text();
      const ldJsonRegex = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      let data: Record<string, unknown> | null = null;
      let ldMatch: RegExpExecArray | null;

      while ((ldMatch = ldJsonRegex.exec(html)) !== null) {
        try {
          const p = JSON.parse(ldMatch[1]) as Record<string, unknown>;
          if (p['@type'] === 'SoftwareApplication' || p['name']) {
            data = p;
            break;
          }
        } catch {
          // continue
        }
      }
      if (!data) return null;

      const aggregateRating = data['aggregateRating'] as Record<string, unknown> | undefined;
      const author = data['author'] as Record<string, unknown> | undefined;

      platformResult = {
        platform: 'play',
        name: String(data['name'] ?? ''),
        icon: data['image'] ? String(data['image']) : null,
        publisher: author?.['name'] ? String(author['name']) : null,
        rating: aggregateRating?.['ratingValue']
          ? parseFloat(String(aggregateRating['ratingValue'])) || null
          : null,
        reviewCount: aggregateRating?.['ratingCount']
          ? parseInt(String(aggregateRating['ratingCount']), 10) || null
          : null,
      };
    } else if (url.includes('apps.apple.com') || url.includes('itunes.apple.com')) {
      const appIdMatch = url.match(/\/id(\d+)/);
      if (!appIdMatch) return null;
      const appId = appIdMatch[1];

      const resp = await fetch(
        `https://itunes.apple.com/lookup?id=${appId}&country=us&entity=software`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!resp.ok) return null;

      const json = await resp.json() as { resultCount: number; results: Record<string, unknown>[] };
      if (!json.results || json.results.length === 0) return null;

      const app = json.results[0];
      platformResult = {
        platform: 'appstore',
        name: String(app['trackName'] ?? ''),
        icon: app['artworkUrl512'] ? String(app['artworkUrl512']) : null,
        publisher: app['artistName'] ? String(app['artistName']) : null,
        rating: app['averageUserRating'] != null ? Number(app['averageUserRating']) : null,
        reviewCount: app['userRatingCount'] != null ? Number(app['userRatingCount']) : null,
      };
    }

    // Suppress unused variable warning — encoded is declared above but only needed if we used the route
    void encoded;

    return platformResult;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('ps_session')?.value;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as RefreshBody | null;
  if (!body?.appId) return NextResponse.json({ message: 'appId is required' }, { status: 400 });

  const { appId, playStoreUrl, appStoreUrl } = body;

  // Fetch metadata for each provided URL concurrently
  const [playMeta, appStoreMeta] = await Promise.all([
    playStoreUrl ? fetchStoreMeta(playStoreUrl) : Promise.resolve(null),
    appStoreUrl ? fetchStoreMeta(appStoreUrl) : Promise.resolve(null),
  ]);

  // Combine: prefer App Store for icon/publisher when available
  const combined: CombinedStoreMeta = {};

  const iconUrl = appStoreMeta?.icon ?? playMeta?.icon ?? null;
  if (iconUrl) combined.storeIconUrl = iconUrl;

  const publisher = appStoreMeta?.publisher ?? playMeta?.publisher ?? null;
  if (publisher) combined.publisherName = publisher;

  if (playMeta?.rating != null) combined.playRating = playMeta.rating;
  if (appStoreMeta?.rating != null) combined.appStoreRating = appStoreMeta.rating;
  if (playMeta?.reviewCount != null) combined.playReviewCount = playMeta.reviewCount;
  if (appStoreMeta?.reviewCount != null) combined.appStoreReviewCount = appStoreMeta.reviewCount;

  // Call Fastify PATCH /admin/apps/:appId/store
  try {
    const patchRes = await fetch(`${API_URL}/admin/apps/${appId}/store`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...(playStoreUrl ? { playStoreUrl } : {}),
        ...(appStoreUrl ? { appStoreUrl } : {}),
        storeMeta: combined,
      }),
      cache: 'no-store',
    });

    if (!patchRes.ok) {
      let message = `HTTP ${patchRes.status}`;
      try {
        const errBody = await patchRes.json() as { message?: string; error?: string };
        message = errBody.message ?? errBody.error ?? message;
      } catch {}
      return NextResponse.json({ message }, { status: patchRes.status });
    }

    const updated = await patchRes.json();
    return NextResponse.json({ ...updated, combined });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
