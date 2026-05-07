import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function GET(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const appId = searchParams.get('appId');
  if (!appId) return NextResponse.json({ error: 'missing appId' }, { status: 400 });

  // Forward all query params except appId
  const forwardParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'appId') forwardParams.set(key, value);
  });

  const res = await fetch(`${API_URL}/admin/apps/${appId}/metrics?${forwardParams}`, {
    headers: authHeaders(token),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
