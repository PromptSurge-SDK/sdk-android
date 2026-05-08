'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type {
  TapThroughPoint, EventCountPoint, GeoRow, RpiSummary, HoldoutStats,
  Keyword, PromptText,
} from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

// ─── Keyword status logic ─────────────────────────────────────────────────────

type KeywordStatus = 'active' | 'discarded' | 'lacking';

function getKeywordStatus(kw: Keyword, prompts: PromptText[], totalImpressions: number): KeywordStatus {
  const related = prompts.filter(p => p.sourceKeywords.includes(kw.text));
  if (related.length === 0) return 'lacking';
  const hasActive = related.some(p => p.status === 'active');
  if (hasActive) return totalImpressions >= 100 ? 'active' : 'lacking';
  return 'discarded';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AllMetrics {
  tapThrough: TapThroughPoint[];
  impressions: EventCountPoint[];
  geo: GeoRow[];
  rpi: RpiSummary | null;
  holdout: HoldoutStats | null;
}

// ─── Baseline banner ──────────────────────────────────────────────────────────

function BaselineBanner({ holdout }: { holdout: HoldoutStats | null }) {
  if (!holdout) return null;

  if (!holdout.hasBaseline) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
        <svg className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Holdout baseline: collecting — {holdout.holdout.devices} / 50 devices needed for the control group comparison.
        </span>
      </div>
    );
  }

  const uplift = holdout.treatment.nativeRate - holdout.holdout.nativeRate;
  const positive = uplift >= 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-xs">
      <span className="font-semibold text-brand-700">Holdout baseline</span>
      <span className="text-brand-600">
        Treatment <strong>{holdout.treatment.nativeRate.toFixed(1)}%</strong> native review rate
      </span>
      <span className="text-gray-400">vs</span>
      <span className="text-gray-600">
        Holdout (no pre-prompt) <strong>{holdout.holdout.nativeRate.toFixed(1)}%</strong>
      </span>
      <span className={`font-semibold ${positive ? 'text-green-700' : 'text-red-600'}`}>
        {positive ? '+' : ''}{uplift.toFixed(1)} pp uplift
      </span>
      <span className="text-gray-400">
        · {holdout.treatment.devices.toLocaleString()} treatment / {holdout.holdout.devices.toLocaleString()} holdout devices
      </span>
    </div>
  );
}

// ─── Keyword cluster table ────────────────────────────────────────────────────

const STATUS_STYLE: Record<KeywordStatus, string> = {
  active:    'bg-green-50 text-green-700',
  discarded: 'bg-gray-100 text-gray-500',
  lacking:   'bg-amber-50 text-amber-700',
};

const STATUS_LABEL: Record<KeywordStatus, string> = {
  active:    'Active',
  discarded: 'Discarded',
  lacking:   'Lacking data',
};

function KeywordTable({ keywords, prompts, totalImpressions }: {
  keywords: Keyword[];
  prompts: PromptText[];
  totalImpressions: number;
}) {
  // Only positive keywords carry useful performance signal
  const positive = keywords.filter(k => k.type === 'positive');

  if (positive.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No positive keywords added yet. Add them in the Keywords section to track their influence here.
      </p>
    );
  }

  const rows = positive.map(kw => {
    const related = prompts.filter(p => p.sourceKeywords.includes(kw.text));
    const activePrompts = related.filter(p => p.status === 'active').length;
    const status = getKeywordStatus(kw, prompts, totalImpressions);
    return { kw, related: related.length, activePrompts, status };
  });

  const ORDER: Record<KeywordStatus, number> = { active: 0, discarded: 1, lacking: 2 };
  rows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.kw.text.localeCompare(b.kw.text));

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Keyword</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Status</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-500">Active prompts</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-500">Total prompts</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ kw, related, activePrompts, status }, i) => (
            <tr key={kw.id} className={i !== rows.length - 1 ? 'border-b border-gray-100' : ''}>
              <td className="px-4 py-2.5 font-medium text-gray-800">{kw.text}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right text-gray-600">{activePrompts}</td>
              <td className="px-4 py-2.5 text-right text-gray-600">{related}</td>
              <td className="px-4 py-2.5 text-gray-400">
                {status === 'lacking' && related === 0 && 'Not yet used in a generated prompt'}
                {status === 'lacking' && related > 0 && '< 100 impressions in period'}
                {status === 'discarded' && 'All associated prompts are discarded'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────

function ChartCard({
  title, subtitle, exportUrl, children,
}: {
  title: string; subtitle?: string; exportUrl: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-900">{title}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <a href={exportUrl} className="shrink-0 text-xs text-brand-600 hover:underline">
          Export CSV ↓
        </a>
      </div>
      {children}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  appId: string;
  keywords: Keyword[];
  prompts: PromptText[];
}

export function MetricsClient({ appId, keywords, prompts }: Props) {
  const [preset, setPreset] = useState(30);
  const [from, setFrom] = useState(() => isoDate(daysAgo(30)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [version, setVersion] = useState('');
  const [versions, setVersions] = useState<string[]>([]);
  const [data, setData] = useState<AllMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/app-metrics?appId=${appId}&metric=versions`);
      if (res.ok) {
        const d = await res.json();
        setVersions(d.versions ?? []);
      }
    } catch {}
  }, [appId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const vq = version ? `&version=${encodeURIComponent(version)}` : '';
      const base = `/api/app-metrics?appId=${appId}&from=${from}&to=${to}${vq}`;
      const [tapRes, impRes, geoRes, rpiRes, holdoutRes] = await Promise.all([
        fetch(`${base}&metric=tap_through`),
        fetch(`${base}&metric=event_counts&eventType=pre_prompt_shown`),
        fetch(`${base}&metric=geo_breakdown`),
        fetch(`${base}&metric=reviews_per_install`),
        fetch(`/api/app-metrics?appId=${appId}&from=${from}&to=${to}&metric=holdout_stats`),
      ]);

      const [tap, imp, geo, rpi, holdout] = await Promise.all([
        tapRes.json(), impRes.json(), geoRes.json(), rpiRes.json(), holdoutRes.json(),
      ]);

      setData({
        tapThrough: tap.series ?? [],
        impressions: imp.series ?? [],
        geo: geo.rows ?? [],
        rpi: rpiRes.ok ? (rpi as RpiSummary) : null,
        holdout: holdoutRes.ok ? (holdout as HoldoutStats) : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [appId, from, to, version]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const startInterval = () => {
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') fetchAll();
      }, 60_000);
    };
    const stopInterval = () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
    const handleVisibility = () => {
      document.visibilityState === 'visible' ? startInterval() : stopInterval();
    };
    startInterval();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { stopInterval(); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [fetchAll]);

  function applyPreset(days: number) {
    setPreset(days);
    setFrom(isoDate(daysAgo(days)));
    setTo(isoDate(new Date()));
  }

  function csvExportUrl(metric: string): string {
    const vq = version ? `&version=${encodeURIComponent(version)}` : '';
    return `/api/app-metrics-export?appId=${appId}&metric=${metric}&from=${from}&to=${to}${vq}`;
  }

  const totalImpressions = data?.impressions.reduce((s, r) => s + r.count, 0) ?? 0;
  const isEmpty = !loading && data && data.tapThrough.length === 0 && data.impressions.length === 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                preset === p.days && from === isoDate(daysAgo(p.days))
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <input
            type="date" value={from}
            onChange={e => { setFrom(e.target.value); setPreset(0); }}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <span className="text-gray-400">–</span>
          <input
            type="date" value={to}
            onChange={e => { setTo(e.target.value); setPreset(0); }}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        {versions.length > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <label className="text-xs text-gray-500">Store-reported version</label>
            <select
              value={version}
              onChange={e => setVersion(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">All versions</option>
              {versions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}

        {loading && <span className="animate-pulse text-xs text-gray-400">Refreshing…</span>}
      </div>

      {/* Frozen holdout baseline banner */}
      <BaselineBanner holdout={data?.holdout ?? null} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-20 text-center">
          <p className="text-lg font-semibold text-gray-700">No data yet</p>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Integrate the SDK and trigger your first prompt to see metrics here.
          </p>
        </div>
      )}

      {data && !isEmpty && (
        <>
          {/* Row 1: Impressions + TTR */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ChartCard
              title="Prompt Impressions"
              subtitle="pre_prompt_shown events over time"
              exportUrl={csvExportUrl('event_counts')}
            >
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.impressions} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Impressions" stroke="#7c3aed" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Tap-through Rate"
              subtitle="% of shown prompts that were confirmed"
              exportUrl={csvExportUrl('tap_through')}
            >
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.tapThrough} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v: unknown) => `${Number(v)}%`} />
                  <Line type="monotone" dataKey="tapThroughRate" name="Tap-through %" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Row 2: Confirms/Dismisses + RPI */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ChartCard
              title="Confirms vs Dismisses"
              subtitle="Stacked area — confirm + dismiss breakdowns"
              exportUrl={csvExportUrl('tap_through')}
            >
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.tapThrough} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="prePromptConfirmed" name="Confirmed" stackId="1" stroke="#059669" fill="#d1fae5" />
                  <Area type="monotone" dataKey="prePromptDismissed" name="Dismissed" stackId="1" stroke="#dc2626" fill="#fee2e2" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {data.rpi ? (
              <div className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      Reviews per Install
                      <span className="ml-2 text-xs font-normal text-gray-400">(first-open proxy)</span>
                    </p>
                    <p className="mt-2 text-4xl font-bold text-gray-900">{data.rpi.ratio.toFixed(2)}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {data.rpi.nativePromptRequested.toLocaleString()} review requests ÷{' '}
                      {data.rpi.firstOpen.toLocaleString()} installs
                    </p>
                    <p className="mt-2 max-w-sm text-xs text-gray-400">
                      Install count uses the SDK&apos;s <code>first_open</code> event as a proxy (fires once per install).
                      For exact store install counts, integrate App Store Connect or Play Console (planned).
                    </p>
                  </div>
                  <a href={csvExportUrl('reviews_per_install')} className="shrink-0 text-xs text-brand-600 hover:underline">
                    Export CSV ↓
                  </a>
                </div>
                {data.rpi.series.length > 0 && (
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={100}>
                      <LineChart data={data.rpi.series} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <XAxis dataKey="date" hide />
                        <Tooltip formatter={(v: unknown) => Number(v).toFixed(2)} />
                        <Line type="monotone" dataKey="ratio" name="Ratio" stroke="#7c3aed" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-5 flex items-center justify-center text-sm text-gray-400">
                Reviews per Install — no data yet
              </div>
            )}
          </div>

          {/* Geo breakdown — full width */}
          {data.geo.length > 0 && (
            <ChartCard
              title="Geo Breakdown"
              subtitle="Top locales by prompt impressions"
              exportUrl={csvExportUrl('geo_breakdown')}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-4">Locale</th>
                      <th className="pb-2 pr-4 text-right">Impressions</th>
                      <th className="pb-2 pr-4 text-right">TTR</th>
                      <th className="pb-2 pr-4 text-right">Confirmation rate</th>
                      <th className="pb-2 text-right">vs baseline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.geo.map(row => {
                      const confirmRate = row.shown > 0 ? (row.confirmed / row.shown) * 100 : 0;
                      const baselineRate = data.holdout?.holdout.nativeRate ?? null;
                      const delta = baselineRate !== null ? row.tapThroughRate - baselineRate : null;
                      return (
                        <tr key={row.locale} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 pr-4 font-mono text-xs">{row.locale}</td>
                          <td className="py-2 pr-4 text-right">{row.shown.toLocaleString()}</td>
                          <td className="py-2 pr-4 text-right">{row.tapThroughRate.toFixed(1)}%</td>
                          <td className="py-2 pr-4 text-right">{confirmRate.toFixed(1)}%</td>
                          <td className="py-2 text-right">
                            {delta !== null ? (
                              <span className={delta >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {delta >= 0 ? '+' : ''}{delta.toFixed(1)} pp
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
        </>
      )}

      {/* Per-keyword cluster table — always shown */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="font-semibold text-gray-900">Performance by keyword</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Keyword status derived from prompt associations in the selected period.
              Per-prompt event attribution is planned for a future SDK release.
            </p>
          </div>
        </div>
        <KeywordTable keywords={keywords} prompts={prompts} totalImpressions={totalImpressions} />
      </div>
    </div>
  );
}
