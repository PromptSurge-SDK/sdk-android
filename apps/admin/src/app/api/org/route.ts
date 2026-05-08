import { NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

async function forward(path: string, init: RequestInit, token: string) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });
  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}

// GET /api/org                          → GET /admin/org
// GET /api/org?sub=members              → GET /admin/org/members
// GET /api/org?sub=invites              → GET /admin/org/invites
// POST /api/org?sub=invites             → POST /admin/org/invites
// PATCH /api/org?sub=members&id=        → PATCH /admin/org/members/:id
// DELETE /api/org?sub=members&id=       → DELETE /admin/org/members/:id
// DELETE /api/org?sub=invites&id=       → DELETE /admin/org/invites/:id
export async function GET(req: Request) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sub = searchParams.get('sub');

  const path = sub ? `/admin/org/${sub}` : '/admin/org';
  return forward(path, { method: 'GET' }, token);
}

export async function POST(req: Request) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sub = searchParams.get('sub');
  const body = await req.text();

  const path = sub ? `/admin/org/${sub}` : '/admin/org';
  return forward(path, { method: 'POST', body }, token);
}

export async function PATCH(req: Request) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sub = searchParams.get('sub');
  const id = searchParams.get('id');
  const body = await req.text();

  if (sub !== 'members' || !id) return NextResponse.json({ error: 'Missing sub or id' }, { status: 400 });
  return forward(`/admin/org/members/${id}`, { method: 'PATCH', body }, token);
}

export async function DELETE(req: Request) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sub = searchParams.get('sub');   // 'members' | 'invites'
  const id = searchParams.get('id');

  if (!sub || !id) return NextResponse.json({ error: 'Missing sub or id' }, { status: 400 });
  return forward(`/admin/org/${sub}/${id}`, { method: 'DELETE', body: '{}' }, token);
}
