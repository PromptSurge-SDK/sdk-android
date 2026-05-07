import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// GET /api/app-themes?appId=...&status=...
export async function GET(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get('appId');
  const status = searchParams.get('status');
  if (!appId) return NextResponse.json({ error: 'missing appId' }, { status: 400 });
  const qs = status ? `?status=${status}` : '';
  const res = await fetch(`${API_URL}/admin/apps/${appId}/themes${qs}`, {
    headers: authHeaders(token),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

// POST /api/app-themes — accept/discard/patch label
export async function POST(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { appId, themeId, action, label } = await req.json();
  if (!appId || !themeId || !action) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

  if (action === 'accept' || action === 'discard') {
    const res = await fetch(`${API_URL}/admin/apps/${appId}/themes/${themeId}/${action}`, {
      method: 'POST',
      headers: authHeaders(token),
      body: '{}',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (action === 'patch-label') {
    const res = await fetch(`${API_URL}/admin/apps/${appId}/themes/${themeId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
