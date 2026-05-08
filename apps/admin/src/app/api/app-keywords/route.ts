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
  const sub = searchParams.get('sub');
  if (!appId) return NextResponse.json({ error: 'missing appId' }, { status: 400 });

  if (sub === 'banned') {
    const res = await fetch(`${API_URL}/admin/apps/${appId}/keywords/banned`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }

  if (sub === 'audit-log') {
    const format = searchParams.get('format');
    const url = `${API_URL}/admin/apps/${appId}/keywords/audit-log${format === 'csv' ? '?format=csv' : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (format === 'csv') {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="keyword-audit-log.csv"',
        },
      });
    }
    return NextResponse.json(await res.json(), { status: res.status });
  }

  if (sub === 'export') {
    const res = await fetch(`${API_URL}/admin/apps/${appId}/keywords/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="keywords.csv"',
      },
    });
  }

  return NextResponse.json({ error: 'bad request' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { appId, texts, type, csv } = await req.json();

  // CSV bulk import
  if (csv !== undefined) {
    const res = await fetch(`${API_URL}/admin/apps/${appId}/keywords/import`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ csv, type }),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }

  const res = await fetch(`${API_URL}/admin/apps/${appId}/keywords`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ texts, type }),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function DELETE(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { appId, keywordId } = await req.json();
  await fetch(`${API_URL}/admin/apps/${appId}/keywords/${keywordId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return new NextResponse(null, { status: 204 });
}
