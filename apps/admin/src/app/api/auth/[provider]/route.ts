/**
 * GET /api/auth/[provider]?action=login|link&next=/some/path
 *
 * Builds the OAuth authorization URL for the given provider, stores a
 * signed state in a short-lived cookie, and redirects the browser.
 */
import { NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4000';
const STATE_SECRET = process.env.OAUTH_STATE_SECRET ?? 'dev-secret-change-me';

interface ProviderConfig {
  authUrl: string;
  clientId: string;
  scope: string;
  /** Apple needs response_mode=form_post + response_type=code id_token */
  extra?: Record<string, string>;
}

function getConfig(provider: string): ProviderConfig | null {
  switch (provider) {
    case 'google':
      return {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        scope: 'openid email profile',
        extra: { access_type: 'offline', prompt: 'select_account' },
      };
    case 'github':
      return {
        authUrl: 'https://github.com/login/oauth/authorize',
        clientId: process.env.GITHUB_CLIENT_ID ?? '',
        scope: 'user:email',
      };
    case 'apple':
      return {
        authUrl: 'https://appleid.apple.com/auth/authorize',
        clientId: process.env.APPLE_CLIENT_ID ?? '',
        scope: 'name email',
        extra: { response_type: 'code', response_mode: 'form_post' },
      };
    case 'facebook':
      return {
        authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
        clientId: process.env.FACEBOOK_APP_ID ?? '',
        scope: 'email',
      };
    default:
      return null;
  }
}

/** Create HMAC-signed state: `nonce:action:next` */
function makeState(action: string, next: string): string {
  const nonce = randomBytes(16).toString('hex');
  const payload = `${nonce}:${action}:${encodeURIComponent(next)}`;
  const sig = createHmac('sha256', STATE_SECRET).update(payload).digest('hex').slice(0, 16);
  return `${payload}:${sig}`;
}

export async function GET(
  req: Request,
  { params }: { params: { provider: string } },
) {
  const { provider } = params;
  const config = getConfig(provider);
  if (!config || !config.clientId) {
    return NextResponse.json({ error: 'provider_not_configured' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'login'; // 'login' | 'link'
  const next = searchParams.get('next') ?? '/dashboard';

  const state = makeState(action, next);
  const redirectUri = `${APP_URL}/api/auth/callback/${provider}`;

  const url = new URL(config.authUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);

  // Apple sets response_type and response_mode in extra; others use code
  if (!config.extra?.response_type) {
    url.searchParams.set('response_type', 'code');
  }
  for (const [k, v] of Object.entries(config.extra ?? {})) {
    url.searchParams.set(k, v);
  }

  const res = NextResponse.redirect(url.toString());
  res.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
