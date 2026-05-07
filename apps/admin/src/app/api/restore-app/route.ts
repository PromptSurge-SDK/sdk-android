import { NextRequest, NextResponse } from 'next/server';
import { restoreApp, ApiError } from '@/lib/api';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('ps_session')?.value;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { appId?: string } | null;
  if (!body?.appId) return NextResponse.json({ message: 'appId is required' }, { status: 400 });

  try {
    const result = await restoreApp(token, body.appId);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}
