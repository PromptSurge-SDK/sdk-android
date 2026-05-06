import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'ps_session';
const MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.token || typeof body.token !== 'string') {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, body.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
