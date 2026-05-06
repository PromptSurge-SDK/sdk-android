const API_URL =
  (typeof window === 'undefined'
    ? process.env.PROMPTSURGE_API_URL
    : process.env.NEXT_PUBLIC_API_URL) ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers: extraHeaders, ...rest } = options;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders ?? {}),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {}
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface Developer {
  id: string;
  email: string;
  createdAt: string;
}

export interface Session {
  token: string;
  developer: Developer;
}

export function signup(email: string, password: string): Promise<Session> {
  return apiFetch('/admin/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string): Promise<Session> {
  return apiFetch('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout(token: string): Promise<void> {
  return apiFetch('/admin/logout', { method: 'POST', token });
}

export function getMe(token: string): Promise<Developer> {
  return apiFetch('/admin/me', { token });
}

// ─── Apps ─────────────────────────────────────────────────────────────────────

export interface App {
  id: string;
  name: string;
  createdAt: string;
  _count?: { events: number };
}

export interface ApiKeyInfo {
  id: string;
  key: string;
  createdAt: string;
}

export interface AppWithKey {
  app: App;
  apiKey: ApiKeyInfo;
}

export interface ApiKey {
  id: string;
  key: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface AppSummary {
  id: string;
  name: string;
  createdAt: string;
  keyCount: number;
  eventCount: number;
}

export interface AppDetail {
  id: string;
  name: string;
  createdAt: string;
  keyCount: number;
  eventCount: number;
  activeKeys: { id: string; createdAt: string; revokedAt: string | null }[];
}

export async function getApps(token: string): Promise<AppSummary[]> {
  const data = await apiFetch<{ apps: AppSummary[] }>('/admin/apps', { token });
  return data.apps;
}

export function createApp(token: string, name: string): Promise<AppWithKey> {
  return apiFetch('/admin/apps', {
    method: 'POST',
    token,
    body: JSON.stringify({ name }),
  });
}

export function getApp(token: string, appId: string): Promise<AppDetail> {
  return apiFetch(`/admin/apps/${appId}`, { token });
}

export interface RotateKeyResult {
  apiKey: ApiKeyInfo;
  revokedCount: number;
  gracePeriodDays: number;
}

export function rotateKey(token: string, appId: string): Promise<RotateKeyResult> {
  return apiFetch(`/admin/apps/${appId}/keys/rotate`, { method: 'POST', token });
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface EventRow {
  id: string;
  eventType: string;
  timestamp: string;
  deviceId: string;
  appVersion: string;
  locale: string;
  resolvedLocale: string | null;
  platform: string;
}

export interface EventsResponse {
  events: EventRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export function getEvents(
  token: string,
  appId: string,
  page = 1
): Promise<EventsResponse> {
  return apiFetch(`/admin/events?appId=${appId}&page=${page}`, { token });
}
