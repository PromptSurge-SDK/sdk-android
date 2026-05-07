import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function POST(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { appId, text, confirmed, sourceHash } = await req.json();
  if (!appId || !text) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

  const res = await fetch(`${API_URL}/admin/apps/${appId}/themes/analyze`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ text, confirmed: confirmed ?? false, sourceHash }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
