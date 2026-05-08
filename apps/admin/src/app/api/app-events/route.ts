import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get('appId');
  const page = searchParams.get('page') ?? '1';
  if (!appId) return NextResponse.json({ error: 'missing appId' }, { status: 400 });

  const res = await fetch(`${API_URL}/admin/events?appId=${appId}&page=${page}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
