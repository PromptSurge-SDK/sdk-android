import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const token = getSessionToken();
  if (!token) return new NextResponse('unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const appId = searchParams.get('appId');
  if (!appId) return new NextResponse('missing appId', { status: 400 });

  const forwardParams = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'appId') forwardParams.set(key, value);
  });

  const res = await fetch(
    `${API_URL}/admin/apps/${appId}/metrics/export.csv?${forwardParams}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const csv = await res.text();
  const contentDisposition = res.headers.get('content-disposition') ?? 'attachment; filename="export.csv"';

  return new NextResponse(csv, {
    status: res.status,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': contentDisposition,
    },
  });
}
