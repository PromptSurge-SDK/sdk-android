import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function GET(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const appId = new URL(req.url).searchParams.get('appId');
  if (!appId) return NextResponse.json({ error: 'missing appId' }, { status: 400 });
  const res = await fetch(`${API_URL}/admin/apps/${appId}/appearance`, { headers: auth(token) });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function PUT(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const appId = new URL(req.url).searchParams.get('appId');
  if (!appId) return NextResponse.json({ error: 'missing appId' }, { status: 400 });
  const body = await req.json();
  const res = await fetch(`${API_URL}/admin/apps/${appId}/appearance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
