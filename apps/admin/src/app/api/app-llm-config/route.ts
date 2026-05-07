import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// PUT: save or replace LLM config
export async function PUT(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { appId, ...body } = await req.json();
  const res = await fetch(`${API_URL}/admin/apps/${appId}/llm-config`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

// POST: test connection
export async function POST(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { appId, action } = await req.json();
  if (action === 'test') {
    const res = await fetch(`${API_URL}/admin/apps/${appId}/llm-config/test`, {
      method: 'POST',
      headers: authHeaders(token),
      body: '{}',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
