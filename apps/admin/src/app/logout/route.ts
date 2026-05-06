import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/lib/api';

const COOKIE = 'ps_session';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (token) {
    await logout(token).catch(() => {});
  }
  const res = NextResponse.redirect(new URL('/login', req.url));
  res.cookies.delete(COOKIE);
  return res;
}

// Handle GET for the form action fallback
export async function GET(req: NextRequest) {
  return POST(req);
}
