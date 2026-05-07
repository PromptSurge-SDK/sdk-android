import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/lib/api';

const API_URL =
  (typeof window === 'undefined'
    ? process.env.PROMPTSURGE_API_URL
    : process.env.NEXT_PUBLIC_API_URL) ?? 'http://localhost:3000';

interface StoreMeta {
  storeIconUrl?: string;
  publisherName?: string;
  playRating?: number;
  appStoreRating?: number;
  playReviewCount?: number;
  appStoreReviewCount?: number;
}

interface CreateAppBody {
  name: string;
  playStoreUrl?: string;
  appStoreUrl?: string;
  storeMeta?: StoreMeta;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('ps_session')?.value;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as CreateAppBody | null;
  if (!body?.name) return NextResponse.json({ message: 'App name is required' }, { status: 400 });

  const payload: CreateAppBody = { name: body.name };
  if (body.playStoreUrl) payload.playStoreUrl = body.playStoreUrl;
  if (body.appStoreUrl) payload.appStoreUrl = body.appStoreUrl;
  if (body.storeMeta) payload.storeMeta = body.storeMeta;

  try {
    const res = await fetch(`${API_URL}/admin/apps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const errBody = await res.json() as { message?: string; error?: string };
        message = errBody.message ?? errBody.error ?? message;
      } catch {}
      return NextResponse.json({ message }, { status: res.status });
    }

    const result = await res.json();
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}
