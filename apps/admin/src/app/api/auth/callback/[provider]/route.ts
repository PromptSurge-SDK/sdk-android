/**
 * OAuth callback handlers.
 *
 * GET  /api/auth/callback/[provider]  — Google, GitHub, Facebook (code in query)
 * POST /api/auth/callback/[provider]  — Apple (form_post: code + id_token in body)
 *
 * Flow:
 *  1. Verify state (HMAC + cookie match).
 *  2. Exchange code for access token with provider.
 *  3. Fetch user identity (provider ID + email) from provider.
 *  4. POST to Fastify /admin/auth/oauth or /admin/auth/oauth/link.
 *  5. Store session token in cookie (via /api/session).
 *  6. Redirect to `next` from state (or /dashboard).
 */
import { NextResponse } from 'next/server';
import { createHmac, createSign } from 'crypto';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4000';
const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';
const STATE_SECRET = process.env.OAUTH_STATE_SECRET ?? 'dev-secret-change-me';

// ─── State helpers ────────────────────────────────────────────────────────────

function verifyState(state: string): { action: string; next: string } | null {
  const parts = state.split(':');
  if (parts.length < 4) return null;
  const sig = parts[parts.length - 1];
  const payload = parts.slice(0, parts.length - 1).join(':');
  const expectedSig = createHmac('sha256', STATE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16);
  if (sig !== expectedSig) return null;
  // payload = nonce:action:encodedNext
  const [, action, encodedNext] = payload.split(':');
  return { action: action ?? 'login', next: decodeURIComponent(encodedNext ?? '/dashboard') };
}

function errorRedirect(msg: string): NextResponse {
  return NextResponse.redirect(`${APP_URL}/login?error=${encodeURIComponent(msg)}`);
}

// ─── Provider-specific token + userinfo ──────────────────────────────────────

interface OAuthIdentity {
  providerAccountId: string;
  email?: string;
}

async function exchangeGoogle(code: string, redirectUri: string): Promise<OAuthIdentity> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json() as { access_token?: string };
  if (!tokens.access_token) throw new Error('google_token_exchange_failed');

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const user = await userRes.json() as { id?: string; email?: string };
  if (!user.id) throw new Error('google_userinfo_failed');
  return { providerAccountId: user.id, email: user.email };
}

async function exchangeGitHub(code: string, redirectUri: string): Promise<OAuthIdentity> {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID ?? '',
      client_secret: process.env.GITHUB_CLIENT_SECRET ?? '',
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokens = await tokenRes.json() as { access_token?: string };
  if (!tokens.access_token) throw new Error('github_token_exchange_failed');

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'PromptSurge' },
  });
  const user = await userRes.json() as { id?: number; email?: string | null };
  if (!user.id) throw new Error('github_userinfo_failed');

  // Primary email may be private — fetch email list separately if needed.
  let email = user.email ?? undefined;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'PromptSurge' },
    });
    const emails = await emailsRes.json() as { email: string; primary: boolean; verified: boolean }[];
    email = emails.find((e) => e.primary && e.verified)?.email;
  }
  return { providerAccountId: String(user.id), email };
}

async function exchangeApple(code: string, redirectUri: string): Promise<OAuthIdentity> {
  // Build ES256 JWT client_secret for Apple
  const clientSecret = makeAppleClientSecret();

  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.APPLE_CLIENT_ID ?? '',
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json() as { id_token?: string };
  if (!tokens.id_token) throw new Error('apple_token_exchange_failed');

  // Decode id_token payload (we trust Apple's signature for now; verify if needed)
  const payload = JSON.parse(
    Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString('utf8'),
  ) as { sub?: string; email?: string };
  if (!payload.sub) throw new Error('apple_id_token_parse_failed');
  return { providerAccountId: payload.sub, email: payload.email };
}

async function exchangeFacebook(code: string, redirectUri: string): Promise<OAuthIdentity> {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID ?? '',
    client_secret: process.env.FACEBOOK_APP_SECRET ?? '',
    redirect_uri: redirectUri,
    code,
  });
  const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${params}`);
  const tokens = await tokenRes.json() as { access_token?: string };
  if (!tokens.access_token) throw new Error('facebook_token_exchange_failed');

  const userRes = await fetch(
    `https://graph.facebook.com/me?fields=id,email&access_token=${tokens.access_token}`,
  );
  const user = await userRes.json() as { id?: string; email?: string };
  if (!user.id) throw new Error('facebook_userinfo_failed');
  return { providerAccountId: user.id, email: user.email };
}

/** Minimal ES256 JWT client_secret for Apple's token endpoint. */
function makeAppleClientSecret(): string {
  const teamId = process.env.APPLE_TEAM_ID ?? '';
  const clientId = process.env.APPLE_CLIENT_ID ?? '';
  const keyId = process.env.APPLE_KEY_ID ?? '';
  // Vercel env vars store newlines as literal \n — restore them.
  const privateKey = (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const b64u = (data: string | Buffer): string =>
    (typeof data === 'string' ? Buffer.from(data) : data).toString('base64url');

  const header = b64u(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = b64u(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp: now + 86400 * 180, // 6 months
      aud: 'https://appleid.apple.com',
      sub: clientId,
    }),
  );
  const message = `${header}.${claims}`;
  const signer = createSign('SHA256');
  signer.update(message);
  // dsaEncoding: 'ieee-p1363' gives raw r||s bytes needed for JWT (ES256)
  const sig = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${message}.${b64u(sig)}`;
}

// ─── Shared handler logic ─────────────────────────────────────────────────────

async function handle(
  provider: string,
  code: string,
  rawState: string,
  cookieState: string | undefined,
  sessionToken: string | undefined,
  redirectUri: string,
): Promise<NextResponse> {
  // 1. Verify state
  if (!cookieState || cookieState !== rawState) return errorRedirect('invalid_state');
  const stateData = verifyState(rawState);
  if (!stateData) return errorRedirect('invalid_state');
  const { action, next } = stateData;

  // 2. Exchange code for identity
  let identity: OAuthIdentity;
  try {
    switch (provider) {
      case 'google':   identity = await exchangeGoogle(code, redirectUri);   break;
      case 'github':   identity = await exchangeGitHub(code, redirectUri);   break;
      case 'apple':    identity = await exchangeApple(code, redirectUri);    break;
      case 'facebook': identity = await exchangeFacebook(code, redirectUri); break;
      default:         return errorRedirect('unknown_provider');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'oauth_exchange_failed';
    return errorRedirect(msg);
  }

  // 3. Call Fastify
  let authToken: string;
  if (action === 'link' && sessionToken) {
    // Link to existing account
    const linkRes = await fetch(`${API_URL}/admin/auth/oauth/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ provider, ...identity }),
    });
    if (!linkRes.ok) {
      const body = await linkRes.json() as { error?: string };
      return errorRedirect(body.error ?? 'link_failed');
    }
    // Stay on same session
    const res = NextResponse.redirect(`${APP_URL}${next}`);
    res.cookies.delete('oauth_state');
    return res;
  } else {
    // Login / sign-up
    const oauthRes = await fetch(`${API_URL}/admin/auth/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, ...identity }),
    });
    if (!oauthRes.ok) {
      const body = await oauthRes.json() as { error?: string };
      return errorRedirect(body.error ?? 'oauth_failed');
    }
    const data = await oauthRes.json() as { token: string };
    authToken = data.token;

    // 4. Persist session cookie via /api/session
    const sessionRes = await fetch(`${APP_URL}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: authToken }),
    });
    // Relay Set-Cookie from session route into this response
    const res = NextResponse.redirect(`${APP_URL}${next}`);
    res.cookies.delete('oauth_state');
    sessionRes.headers.getSetCookie?.().forEach((c) => {
      res.headers.append('Set-Cookie', c);
    });
    return res;
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: { provider: string } },
) {
  const { provider } = params;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state) return errorRedirect('missing_code_or_state');

  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookieState = cookieHeader
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === 'oauth_state')?.[1];

  // Read session token from cookies for link action
  const sessionToken = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('ps_session='))
    ?.split('=')?.[1];

  const redirectUri = `${APP_URL}/api/auth/callback/${provider}`;
  return handle(provider, code, state, cookieState, sessionToken, redirectUri);
}

// Apple sends a POST with form data
export async function POST(
  req: Request,
  { params }: { params: { provider: string } },
) {
  const { provider } = params;
  if (provider !== 'apple') return errorRedirect('unexpected_post');

  const form = await req.formData();
  const code = form.get('code') as string | null;
  const state = form.get('state') as string | null;
  if (!code || !state) return errorRedirect('missing_code_or_state');

  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookieState = cookieHeader
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === 'oauth_state')?.[1];

  const sessionToken = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('ps_session='))
    ?.split('=')?.[1];

  const redirectUri = `${APP_URL}/api/auth/callback/apple`;
  return handle('apple', code, state, cookieState, sessionToken, redirectUri);
}
