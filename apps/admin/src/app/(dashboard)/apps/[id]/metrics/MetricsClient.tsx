'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import type {
  TapThroughPoint, EventCountPoint, GeoRow, RpiSummary,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AllMetrics {
  tapThrough: TapThroughPoint[];
  impressions: EventCountPoint[];
  geo: GeoRow[];
  rpi: RpiSummary | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MetricsClient({ appId }: { appId: string }) {
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
      const [tapRes, impRes, geoRes, rpiRes] = await Promise.all([
        fetch(`${base}&metric=tap_through`),
        fetch(`${base}&metric=event_counts&eventType=pre_prompt_shown`),
        fetch(`${base}&metric=geo_breakdown`),
        fetch(`${base}&metric=reviews_per_install`),
      ]);

      const [tap, imp, geo, rpi] = await Promise.all([
        tapRes.json(), impRes.json(), geoRes.json(), rpiRes.json(),
      ]);

      setData({
        tapThrough: tap.series ?? [],
        impressions: imp.series ?? [],
        geo: geo.rows ?? [],
        rpi: rpiRes.ok ? (rpi as RpiSummary) : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [appId, from, to, version]);

  // Load versions once
  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  // Fetch on filter changes
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 60s when tab focused
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
      if (document.visibilityState === 'visible') startInterval();
      else stopInterval();
    };

    startInterval();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
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

  // ─── Empty state ────────────────────────────────────────────────────────────
  const isEmpty = !loading && data &&
    data.tapThrough.length === 0 && data.impressions.length === 0;

  return (
    <div className="space-y-8">
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
          <select
            value={version}
            onChange={e => setVersion(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All versions</option>
            {versions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}

        {loading && <span className="text-xs text-gray-400 animate-pulse">Refreshing…</span>}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-20 text-center">
          <p className="text-lg font-semibold text-gray-700">No data yet</p>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            Integrate the SDK and trigger your first prompt to see metrics here.
          </p>
        </div>
      )}

      {data && !isEmpty && (
        <>
          {/* Impressions chart */}
          <ChartCard
            title="Prompt Impressions"
            subtitle="pre_prompt_shown events over time"
            exportUrl={csvExportUrl('event_counts')}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.impressions} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="Impressions" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Tap-through rate */}
          <ChartCard
            title="Tap-through Rate"
            subtitle="% of shown prompts that were confirmed"
            exportUrl={csvExportUrl('tap_through')}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.tapThrough} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v: unknown) => `${Number(v)}%`} />
                <Line type="monotone" dataKey="tapThroughRate" name="Tap-through %" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Confirms vs Dismisses stacked area */}
          <ChartCard
            title="Confirms vs Dismisses"
            subtitle="Stacked area — confirm + dismiss breakdowns"
            exportUrl={csvExportUrl('tap_through')}
          >
            <ResponsiveContainer width="100%" height={220}>
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

          {/* GEO breakdown */}
          {data.geo.length > 0 && (
            <ChartCard
              title="GEO Breakdown"
              subtitle="Top locales by prompt impressions"
              exportUrl={csvExportUrl('geo_breakdown')}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <th className="pb-2 pr-4">Locale</th>
                      <th className="pb-2 pr-4">Region</th>
                      <th className="pb-2 pr-4 text-right">Impressions</th>
                      <th className="pb-2 text-right">Tap-through</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.geo.map(row => (
                      <tr key={row.locale} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-4 font-mono text-xs">{row.locale}</td>
                        <td className="py-2 pr-4 text-gray-600">{row.region}</td>
                        <td className="py-2 pr-4 text-right">{row.shown.toLocaleString()}</td>
                        <td className="py-2 text-right">{row.tapThroughRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}

          {/* Reviews per Install */}
          {data.rpi && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Reviews per Install
                    <span className="ml-2 text-xs font-normal text-gray-400">(first-open proxy)</span>
                  </p>
                  <p className="text-4xl font-bold text-gray-900 mt-2">{data.rpi.ratio.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {data.rpi.nativePromptRequested.toLocaleString()} review requests ÷{' '}
                    {data.rpi.firstOpen.toLocaleString()} installs
                  </p>
                  <p className="text-xs text-gray-400 mt-2 max-w-sm">
                    Install count uses the SDK&apos;s <code>first_open</code> event as a proxy (fires once per install).
                    For exact store install counts, integrate App Store Connect or Play Console (planned).
                  </p>
                </div>
                <a
                  href={csvExportUrl('reviews_per_install')}
                  className="text-xs text-brand-600 hover:underline shrink-0"
                >
                  Export CSV ↓
                </a>
              </div>

              {data.rpi.series.length > 0 && (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={data.rpi.series} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <XAxis dataKey="date" hide />
                      <Tooltip formatter={(v: unknown) => Number(v).toFixed(2)} />
                      <Line type="monotone" dataKey="ratio" name="Ratio" stroke="#7c3aed" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </>
      )}
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
        <a href={exportUrl} className="text-xs text-brand-600 hover:underline shrink-0">
          Export CSV ↓
        </a>
      </div>
      {children}
    </div>
  );
}
