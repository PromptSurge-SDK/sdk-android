import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

// GET /api/app-subscription?appId=xxx
export async function GET(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const appId = req.nextUrl.searchParams.get('appId');
  const sub   = req.nextUrl.searchParams.get('sub'); // 'checkout' or 'cancel' — handled below
  const tier  = req.nextUrl.searchParams.get('tier');

  if (!appId) return NextResponse.json({ error: 'missing_app_id' }, { status: 400 });

  const path = sub === 'checkout'
    ? `/admin/apps/${appId}/subscription/checkout?tier=${tier ?? ''}`
    : `/admin/apps/${appId}/subscription`;

  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

// POST /api/app-subscription  { appId, action: 'cancel' }
export async function POST(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { appId, action } = body ?? {};

  if (!appId || action !== 'cancel') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const res = await fetch(`${API}/admin/apps/${appId}/subscription/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
    cache: 'no-store',
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
