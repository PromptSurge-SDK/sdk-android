import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { appId, locale, count } = await req.json();
  const res = await fetch(`${API_URL}/admin/apps/${appId}/prompts/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ locale, count }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
