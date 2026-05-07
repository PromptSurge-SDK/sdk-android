import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function POST(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { appId, ...body } = await req.json();
  const res = await fetch(`${API_URL}/admin/apps/${appId}/prompts`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { appId, promptId, ...body } = await req.json();
  const res = await fetch(`${API_URL}/admin/apps/${appId}/prompts/${promptId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { appId, promptId } = await req.json();
  await fetch(`${API_URL}/admin/apps/${appId}/prompts/${promptId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return new NextResponse(null, { status: 204 });
}
