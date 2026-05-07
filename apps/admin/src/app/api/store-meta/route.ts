export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export interface StoreMetaResult {
  platform: 'play' | 'appstore';
  name: string;
  icon: string | null;
  publisher: string | null;
  rating: number | null;
  reviewCount: number | null;
}

interface StoreMetaError {
  error: string;
  message: string;
}

/** Strip locale params and force the canonical English (US) URL. */
function normalizePlayUrl(url: string): string {
  const parsed = new URL(url);
  const packageId = parsed.searchParams.get('id');
  if (!packageId) throw new Error('Missing id parameter in Play Store URL');
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageId)}&hl=en&gl=US`;
}

function normalizeAppStoreUrl(url: string): string {
  const parsed = new URL(url);
  const normalized = parsed.pathname.replace(/^\/[a-z]{2}(-[a-z]{2,4})?(?=\/)/i, '/us');
  return `https://apps.apple.com${normalized}`;
}

async function fetchPlayStoreMeta(url: string): Promise<StoreMetaResult> {
  const canonicalUrl = normalizePlayUrl(url);
  const parsed = new URL(canonicalUrl);
  const packageId = parsed.searchParams.get('id');
  if (!packageId) throw new Error('Missing id parameter in Play Store URL');

  const resp = await fetch(
    canonicalUrl,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!resp.ok) throw new Error(`Play Store fetch failed: ${resp.status}`);

  const html = await resp.text();

  // Extract JSON-LD blocks
  const ldJsonRegex = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let data: Record<string, unknown> | null = null;
  let ldMatch: RegExpExecArray | null;

  while ((ldMatch = ldJsonRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(ldMatch[1]) as Record<string, unknown>;
      if (parsed['@type'] === 'SoftwareApplication' || parsed['name']) {
        data = parsed;
        break;
      }
    } catch {
      // continue to next match
    }
  }

  if (!data) throw new Error('Could not parse JSON-LD from Play Store page');

  const aggregateRating = data['aggregateRating'] as Record<string, unknown> | undefined;
  const author = data['author'] as Record<string, unknown> | undefined;

  const rating = aggregateRating?.['ratingValue']
    ? parseFloat(String(aggregateRating['ratingValue'])) || null
    : null;
  const reviewCount = aggregateRating?.['ratingCount']
    ? parseInt(String(aggregateRating['ratingCount']), 10) || null
    : null;

  return {
    platform: 'play',
    name: String(data['name'] ?? ''),
    icon: data['image'] ? String(data['image']) : null,
    publisher: author?.['name'] ? String(author['name']) : null,
    rating,
    reviewCount,
  };
}

async function fetchAppStoreMeta(url: string): Promise<StoreMetaResult> {
  const appIdMatch = url.match(/\/id(\d+)/);
  if (!appIdMatch) throw new Error('Could not extract app ID from App Store URL');
  const appId = appIdMatch[1];

  const resp = await fetch(
    `https://itunes.apple.com/lookup?id=${appId}&country=us&entity=software`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!resp.ok) throw new Error(`iTunes lookup failed: ${resp.status}`);

  const json = await resp.json() as { resultCount: number; results: Record<string, unknown>[] };
  if (!json.results || json.results.length === 0) throw new Error('App not found in iTunes lookup');

  const app = json.results[0];

  return {
    platform: 'appstore',
    name: String(app['trackName'] ?? ''),
    icon: app['artworkUrl512'] ? String(app['artworkUrl512']) : null,
    publisher: app['artistName'] ? String(app['artistName']) : null,
    rating: app['averageUserRating'] != null ? Number(app['averageUserRating']) : null,
    reviewCount: app['userRatingCount'] != null ? Number(app['userRatingCount']) : null,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse<StoreMetaResult | StoreMetaError>> {
  const rawUrl = req.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'missing_url', message: 'url query parameter is required' }, { status: 400 });
  }

  let storeUrl: string;
  try {
    storeUrl = decodeURIComponent(rawUrl);
    new URL(storeUrl); // validate
  } catch {
    return NextResponse.json({ error: 'invalid_url', message: 'Invalid URL provided' }, { status: 400 });
  }

  try {
    if (storeUrl.includes('play.google.com')) {
      const meta = await fetchPlayStoreMeta(storeUrl);
      return NextResponse.json(meta);
    } else if (storeUrl.includes('apps.apple.com') || storeUrl.includes('itunes.apple.com')) {
      const meta = await fetchAppStoreMeta(storeUrl);
      return NextResponse.json(meta);
    } else {
      return NextResponse.json(
        { error: 'unsupported_platform', message: 'URL must be a Google Play or Apple App Store URL' },
        { status: 400 },
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: 'fetch_failed', message }, { status: 422 });
  }
}
