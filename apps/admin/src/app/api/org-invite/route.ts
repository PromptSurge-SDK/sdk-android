/**
 * Proxy for public invite routes (no auth required for GET, auth for POST).
 *
 * GET  /api/org-invite?token=<token>          → GET  /admin/invites/:token
 * POST /api/org-invite?token=<token>&action=accept → POST /admin/invites/:token/accept
 */
import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const res = await fetch(`${API_URL}/admin/invites/${token}`, { cache: 'no-store' });
  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}

export async function POST(req: Request) {
  const sessionToken = getSessionToken();
  if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const path =
    action === 'accept'
      ? `/admin/invites/${token}/accept`
      : `/admin/invites/${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: '{}',
    cache: 'no-store',
  });
  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}
