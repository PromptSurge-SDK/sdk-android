import { cookies } from 'next/headers';

const COOKIE = 'ps_session';

export function getSessionToken(): string | undefined {
  return cookies().get(COOKIE)?.value;
}

export function setSessionCookie(token: string): void {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearSessionCookie(): void {
  cookies().delete(COOKIE);
}
