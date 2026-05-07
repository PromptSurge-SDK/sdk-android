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
  return apiFetch('/admin/logout', { method: 'POST', token, body: '{}' });
}

export interface Me extends Developer {
  hasPassword: boolean;
  oauthProviders: string[];
}

export function getMe(token: string): Promise<Me> {
  return apiFetch('/admin/me', { token });
}

// ─── Account settings ─────────────────────────────────────────────────────────

export interface LinkedOAuthAccount {
  id: string;
  provider: string;
  email: string | null;
  createdAt: string;
}

export function changePassword(
  token: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  return apiFetch('/admin/account/change-password', {
    method: 'POST',
    token,
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export function setPassword(token: string, newPassword: string): Promise<void> {
  return apiFetch('/admin/account/set-password', {
    method: 'POST',
    token,
    body: JSON.stringify({ newPassword }),
  });
}

export async function getLinkedOAuthAccounts(token: string): Promise<LinkedOAuthAccount[]> {
  const data = await apiFetch<{ accounts: LinkedOAuthAccount[] }>('/admin/account/oauth', { token });
  return data.accounts;
}

export function unlinkOAuthProvider(token: string, provider: string): Promise<{ ok: boolean }> {
  return apiFetch('/admin/account/oauth/unlink', {
    method: 'POST',
    token,
    body: JSON.stringify({ provider }),
  });
}

export function deleteAccount(token: string): Promise<void> {
  return apiFetch('/admin/account', { method: 'DELETE', token, body: '{}' });
}

// ─── Apps ─────────────────────────────────────────────────────────────────────

export interface App {
  id: string;
  name: string;
  createdAt: string;
  _count?: { events: number };
  keyCount?: number;
  eventCount?: number;
  playStoreUrl?: string | null;
  appStoreUrl?: string | null;
  storeIconUrl?: string | null;
  publisherName?: string | null;
  playRating?: number | null;
  appStoreRating?: number | null;
  playReviewCount?: number | null;
  appStoreReviewCount?: number | null;
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

export interface StoreMetaFields {
  playStoreUrl?: string | null;
  appStoreUrl?: string | null;
  storeIconUrl?: string | null;
  publisherName?: string | null;
  playRating?: number | null;
  appStoreRating?: number | null;
  playReviewCount?: number | null;
  appStoreReviewCount?: number | null;
}

export interface AppSummary extends StoreMetaFields {
  id: string;
  name: string;
  createdAt: string;
  deletedAt: string | null;
  keyCount: number;
  eventCount: number;
  /** True if the app has sent at least one event in the last 30 days. */
  sdkActive: boolean;
  /** True if the app is soft-deleted AND no longer protected by any restoration condition. */
  purgeable: boolean;
  /** True if the app was ever linked to a Lemon Squeezy subscription. */
  everPaid: boolean;
}

export interface AppDetail extends StoreMetaFields {
  id: string;
  name: string;
  createdAt: string;
  deletedAt: string | null;
  keyCount: number;
  eventCount: number;
  activeKeys: { id: string; createdAt: string; revokedAt: string | null }[];
}

export async function getApps(token: string): Promise<AppSummary[]> {
  const data = await apiFetch<{ apps: AppSummary[] }>('/admin/apps', { token });
  return data.apps;
}

export interface CreateAppPayload {
  name: string;
  playStoreUrl?: string;
  appStoreUrl?: string;
  storeMeta?: {
    storeIconUrl?: string;
    publisherName?: string;
    playRating?: number;
    appStoreRating?: number;
    playReviewCount?: number;
    appStoreReviewCount?: number;
  };
}

export function createApp(token: string, payload: CreateAppPayload): Promise<AppWithKey> {
  return apiFetch('/admin/apps', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
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

export interface DeleteAppResult {
  deleted: true;
  /** true = immediately hard-deleted (no events, no sub); false = soft-deleted */
  immediate: boolean;
}

export function deleteApp(token: string, appId: string): Promise<DeleteAppResult> {
  return apiFetch(`/admin/apps/${appId}`, { method: 'DELETE', token, body: '{}' });
}

export function restoreApp(token: string, appId: string): Promise<{ ok: true }> {
  return apiFetch(`/admin/apps/${appId}/restore`, { method: 'POST', token, body: '{}' });
}

export function permanentlyDeleteApp(token: string, appId: string): Promise<{ ok: true }> {
  return apiFetch(`/admin/apps/${appId}/permanent`, { method: 'DELETE', token, body: '{}' });
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export type SubscriptionTier = 'indie' | 'startup' | 'growth' | 'enterprise';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'paused';

export interface AppSubscription {
  tier: SubscriptionTier;
  tierLabel: string;
  status: SubscriptionStatus;
  impressions: number;
  limit: number | null;       // null = unlimited (enterprise)
  periodStart: string;
  periodEnd: string | null;
  lsSubscriptionId: string | null;
}

export function getSubscription(token: string, appId: string): Promise<AppSubscription> {
  return apiFetch(`/admin/apps/${appId}/subscription`, { token });
}

export async function getCheckoutUrl(
  token: string,
  appId: string,
  tier: 'startup' | 'growth' | 'enterprise',
): Promise<string> {
  const data = await apiFetch<{ checkoutUrl: string }>(
    `/admin/apps/${appId}/subscription/checkout?tier=${tier}`,
    { token },
  );
  return data.checkoutUrl;
}

export function cancelSubscription(token: string, appId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/admin/apps/${appId}/subscription/cancel`, { method: 'POST', token });
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

// ─── Prompts ──────────────────────────────────────────────────────────────────

export interface PromptText {
  id: string;
  appId: string | null;
  locale: string;
  title: string;
  body: string;
  ctaConfirm: string;
  ctaDismiss: string;
  imageUrl: string | null;
  status: 'draft' | 'active' | 'discarded';
  sourceKeywords: string[];
  generatedByLlm: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getPrompts(token: string, appId: string): Promise<PromptText[]> {
  const data = await apiFetch<{ prompts: PromptText[] }>(`/admin/apps/${appId}/prompts`, { token });
  return data.prompts;
}

export function createPrompt(
  token: string,
  appId: string,
  body: Partial<PromptText> & { locale: string; title: string; body: string; ctaConfirm: string; ctaDismiss: string }
): Promise<{ prompt: PromptText }> {
  return apiFetch(`/admin/apps/${appId}/prompts`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function updatePrompt(
  token: string,
  appId: string,
  promptId: string,
  patch: Partial<PromptText>
): Promise<{ prompt: PromptText }> {
  return apiFetch(`/admin/apps/${appId}/prompts/${promptId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(patch),
  });
}

export function deletePrompt(token: string, appId: string, promptId: string): Promise<void> {
  return apiFetch(`/admin/apps/${appId}/prompts/${promptId}`, { method: 'DELETE', token });
}

// ─── Keywords ─────────────────────────────────────────────────────────────────

export interface Keyword {
  id: string;
  appId: string;
  text: string;
  type: 'positive' | 'negative';
  createdAt: string;
}

export async function getKeywords(token: string, appId: string): Promise<Keyword[]> {
  const data = await apiFetch<{ keywords: Keyword[] }>(`/admin/apps/${appId}/keywords`, { token });
  return data.keywords;
}

export function createKeyword(
  token: string,
  appId: string,
  text: string,
  type: 'positive' | 'negative'
): Promise<{ keyword: Keyword }> {
  return apiFetch(`/admin/apps/${appId}/keywords`, {
    method: 'POST',
    token,
    body: JSON.stringify({ text, type }),
  });
}

export function deleteKeyword(token: string, appId: string, keywordId: string): Promise<void> {
  return apiFetch(`/admin/apps/${appId}/keywords/${keywordId}`, { method: 'DELETE', token });
}

// ─── LLM Config ───────────────────────────────────────────────────────────────

export interface LlmConfig {
  providerType: 'openai_compatible' | 'anthropic' | 'gemini';
  modelName: string;
  baseUrl: string | null;
  apiKeyMasked: string;
  updatedAt: string;
}

export async function getLlmConfig(token: string, appId: string): Promise<LlmConfig | null> {
  const data = await apiFetch<{ config: LlmConfig | null }>(`/admin/apps/${appId}/llm-config`, { token });
  return data.config;
}

export function saveLlmConfig(
  token: string,
  appId: string,
  payload: { providerType: string; modelName: string; baseUrl?: string | null; apiKey: string }
): Promise<{ config: LlmConfig }> {
  return apiFetch(`/admin/apps/${appId}/llm-config`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  });
}

export function testLlmConnection(token: string, appId: string): Promise<{ ok: boolean; error?: string }> {
  return apiFetch(`/admin/apps/${appId}/llm-config/test`, { method: 'POST', token, body: '{}' });
}

export interface ProviderModelOption {
  id: string;
  label: string;
  baseUrl: string;
  isDefault?: boolean;
}

export interface ProvidersResponse {
  providers: Record<string, { label: string; models: ProviderModelOption[] }>;
}

export function getLlmProviders(token: string): Promise<ProvidersResponse> {
  return apiFetch('/admin/llm/providers', { token });
}

export interface GeneratedPromptCandidate {
  title: string;
  body: string;
  ctaConfirm: string;
  ctaDismiss: string;
}

export interface GenerateInfluences {
  keywords: string[];
  themes: string[];
}

export function generatePrompts(
  token: string,
  appId: string,
  locale: string,
  count = 3,
  useThemes = true
): Promise<{ prompts: GeneratedPromptCandidate[]; locale: string; influences?: GenerateInfluences }> {
  return apiFetch(`/admin/apps/${appId}/prompts/generate`, {
    method: 'POST',
    token,
    body: JSON.stringify({ locale, count, useThemes }),
  });
}

// ─── LLM Usage ────────────────────────────────────────────────────────────────

export interface LlmUsageLog {
  id: string;
  providerType: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  errorMessage: string | null;
  purpose: string;
  createdAt: string;
}

export interface LlmUsageResponse {
  logs: LlmUsageLog[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export function getLlmUsage(token: string, appId: string, page = 1): Promise<LlmUsageResponse> {
  return apiFetch(`/admin/apps/${appId}/llm-usage?page=${page}`, { token });
}

// ─── Themes ───────────────────────────────────────────────────────────────────

export interface Theme {
  id: string;
  appId: string;
  label: string;
  frequency: number;
  examplePhrases: string[];
  status: 'pending' | 'accepted' | 'discarded';
  sourceHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyzeEstimate {
  needsConfirmation: true;
  estimatedCostUsd: number;
  reviewCount: number;
  filteredCount: number;
  sourceHash: string;
}

export interface AnalyzeResult {
  themes: Theme[];
  reviewCount: number;
  filteredCount: number;
  actualCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface CachedAnalyzeResult {
  cached: true;
  cachedAt: string;
  themes: Theme[];
  reviewCount: number;
  filteredCount: number;
}

export async function getThemes(
  token: string,
  appId: string,
  status?: string
): Promise<Theme[]> {
  const qs = status ? `?status=${status}` : '';
  const data = await apiFetch<{ themes: Theme[] }>(`/admin/apps/${appId}/themes${qs}`, { token });
  return data.themes;
}

export function analyzeReviews(
  token: string,
  appId: string,
  text: string,
  confirmed = false,
  sourceHash?: string
): Promise<AnalyzeEstimate | AnalyzeResult | CachedAnalyzeResult> {
  return apiFetch(`/admin/apps/${appId}/themes/analyze`, {
    method: 'POST',
    token,
    body: JSON.stringify({ text, confirmed, sourceHash }),
  });
}

export function acceptTheme(token: string, appId: string, themeId: string): Promise<{ theme: Theme }> {
  return apiFetch(`/admin/apps/${appId}/themes/${themeId}/accept`, { method: 'POST', token, body: '{}' });
}

export function discardTheme(token: string, appId: string, themeId: string): Promise<{ theme: Theme }> {
  return apiFetch(`/admin/apps/${appId}/themes/${themeId}/discard`, { method: 'POST', token, body: '{}' });
}

export function updateThemeLabel(
  token: string,
  appId: string,
  themeId: string,
  label: string
): Promise<{ theme: Theme }> {
  return apiFetch(`/admin/apps/${appId}/themes/${themeId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ label }),
  });
}

// ─── Store Config ─────────────────────────────────────────────────────────────

export interface StoreConfig {
  appStoreUrl: string | null;
  playStoreUrl: string | null;
}

export function getStoreConfig(token: string, appId: string): Promise<StoreConfig> {
  return apiFetch(`/admin/apps/${appId}/store-config`, { token });
}

export function saveStoreConfig(
  token: string,
  appId: string,
  config: StoreConfig
): Promise<StoreConfig> {
  return apiFetch(`/admin/apps/${appId}/store-config`, {
    method: 'PUT',
    token,
    body: JSON.stringify(config),
  });
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface TapThroughPoint {
  date: string;
  tapThroughRate: number;
  prePromptShown: number;
  prePromptConfirmed: number;
  prePromptDismissed: number;
}

export interface EventCountPoint {
  date: string;
  count: number;
}

export interface GeoRow {
  locale: string;
  region: string;
  shown: number;
  confirmed: number;
  tapThroughRate: number;
}

export interface RpiPoint {
  date: string;
  nativePromptRequested: number;
  firstOpen: number;
  ratio: number;
}

export interface RpiSummary {
  nativePromptRequested: number;
  firstOpen: number;
  ratio: number;
  series: RpiPoint[];
}

export function getMetricTapThrough(
  token: string, appId: string, from: string, to: string, version?: string
): Promise<{ series: TapThroughPoint[] }> {
  const qs = new URLSearchParams({ metric: 'tap_through', from, to, ...(version ? { version } : {}) });
  return apiFetch(`/admin/apps/${appId}/metrics?${qs}`, { token });
}

export function getMetricEventCounts(
  token: string, appId: string, from: string, to: string, eventType: string, version?: string
): Promise<{ series: EventCountPoint[] }> {
  const qs = new URLSearchParams({ metric: 'event_counts', from, to, eventType, ...(version ? { version } : {}) });
  return apiFetch(`/admin/apps/${appId}/metrics?${qs}`, { token });
}

export function getMetricGeo(
  token: string, appId: string, from: string, to: string
): Promise<{ rows: GeoRow[] }> {
  const qs = new URLSearchParams({ metric: 'geo_breakdown', from, to });
  return apiFetch(`/admin/apps/${appId}/metrics?${qs}`, { token });
}

export function getMetricRpi(
  token: string, appId: string, from: string, to: string, version?: string
): Promise<RpiSummary> {
  const qs = new URLSearchParams({ metric: 'reviews_per_install', from, to, ...(version ? { version } : {}) });
  return apiFetch(`/admin/apps/${appId}/metrics?${qs}`, { token });
}

export async function getMetricVersions(token: string, appId: string): Promise<string[]> {
  const data = await apiFetch<{ versions: string[] }>(`/admin/apps/${appId}/metrics?metric=versions`, { token });
  return data.versions;
}

export function metricsExportUrl(
  appId: string, metric: string, from: string, to: string, version?: string
): string {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  const qs = new URLSearchParams({ metric, from, to, ...(version ? { version } : {}) });
  return `${API_URL}/admin/apps/${appId}/metrics/export.csv?${qs}`;
}

// ─── Org / Team ───────────────────────────────────────────────────────────────

export type OrgRole = 'owner' | 'member';

export interface OrgInfo {
  id: string;
  name: string;
  myRole: OrgRole;
}

export interface OrgMember {
  id: string;
  role: OrgRole;
  developer: { id: string; email: string };
}

export interface OrgInvite {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
  token: string;
}

export interface InvitePreview {
  id: string;
  email: string;
  role: OrgRole;
  orgName: string;
  expiresAt: string;
}

export function getOrg(token: string): Promise<OrgInfo> {
  return apiFetch('/admin/org', { token });
}

export async function getOrgMembers(token: string): Promise<OrgMember[]> {
  const data = await apiFetch<{ members: OrgMember[] }>('/admin/org/members', { token });
  return data.members;
}

export function removeOrgMember(token: string, memberId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/admin/org/members/${memberId}`, { method: 'DELETE', token, body: '{}' });
}

export async function getOrgInvites(token: string): Promise<OrgInvite[]> {
  const data = await apiFetch<{ invites: OrgInvite[] }>('/admin/org/invites', { token });
  return data.invites;
}

export function createInvite(
  token: string,
  email: string,
  role: OrgRole,
): Promise<{ invite: OrgInvite; inviteUrl: string }> {
  return apiFetch('/admin/org/invites', {
    method: 'POST',
    token,
    body: JSON.stringify({ email, role }),
  });
}

export function revokeInvite(token: string, inviteId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/admin/org/invites/${inviteId}`, { method: 'DELETE', token, body: '{}' });
}

export function getInvitePreview(token: string): Promise<InvitePreview> {
  return apiFetch(`/admin/invites/${token}`);
}

export function acceptInvite(
  token: string,
  inviteToken: string,
): Promise<{ ok: boolean; orgId: string; role: OrgRole }> {
  return apiFetch(`/admin/invites/${inviteToken}/accept`, { method: 'POST', token, body: '{}' });
}
