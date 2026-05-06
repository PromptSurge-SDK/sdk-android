import { NextRequest, NextResponse } from 'next/server';
import { createApp, ApiError } from '@/lib/api';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('ps_session')?.value;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.name) return NextResponse.json({ message: 'App name is required' }, { status: 400 });

  try {
    const result = await createApp(token, body.name as string);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    return NextResponse.json({ message: 'Internal error' }, { status: 500 });
  }
}
