'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { TapThroughPoint, RpiSummary, HoldoutStats } from '@/lib/api';

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

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className}`} />;
}

// ─── Metric widget ─────────────────────────────────────────────────────────────

interface MetricWidgetProps {
  title: string;
  value: string;
  subtitle: string;
  color: string;
  data: { date: string; value: number }[];
  loading: boolean;
  dataKey?: string;
}

function MetricWidget({ title, value, subtitle, color, data, loading }: MetricWidgetProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-20 w-full" />
        </div>
      ) : (
        <>
          <p className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
          {data.length > 1 ? (
            <div className="mt-4 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e5e7eb' }}
                    labelFormatter={(l) => fmtDate(String(l))}
                    formatter={(v) => [typeof v === 'number' ? v.toFixed(2) : v, '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={1.5}
                    fill={`url(#grad-${title})`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 flex h-20 items-center justify-center">
              <p className="text-xs text-gray-400">Not enough data yet</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Baseline comparison widget ────────────────────────────────────────────────

function BaselineWidget({ stats, loading }: { stats: HoldoutStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Holdout baseline</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  if (!stats.hasBaseline) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Baseline data collecting</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {stats.holdout.devices} / 50 holdout devices reached. The baseline comparison unlocks once 50+
              devices without the pre-prompt have been observed — giving you a meaningful control group.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const treatRate = stats.treatment.nativeRate;
  const holdRate = stats.holdout.nativeRate;
  const uplift = treatRate - holdRate;
  const upliftPositive = uplift >= 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Holdout baseline</p>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
          upliftPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {upliftPositive ? '+' : ''}{uplift.toFixed(1)} pp uplift
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Treatment */}
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-4">
          <p className="text-xs text-brand-600 font-medium">With pre-prompt</p>
          <p className="mt-1 text-2xl font-bold text-brand-700 tabular-nums">
            {fmtPct(treatRate)}
          </p>
          <p className="text-xs text-brand-500">native review rate</p>
          <p className="mt-2 text-[11px] text-brand-400">{stats.treatment.devices.toLocaleString()} devices</p>
        </div>

        {/* Holdout */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs text-gray-500 font-medium">Without pre-prompt</p>
          <p className="mt-1 text-2xl font-bold text-gray-700 tabular-nums">
            {fmtPct(holdRate)}
          </p>
          <p className="text-xs text-gray-400">native review rate</p>
          <p className="mt-2 text-[11px] text-gray-400">{stats.holdout.devices.toLocaleString()} devices</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-gray-400">
        10% of your installs are randomly placed in a holdout group that never sees the pre-prompt.
        This measures the organic review rate as a baseline for your conversion uplift calculation.
      </p>
    </div>
  );
}

// ─── Useful suggestions scaffold ───────────────────────────────────────────────

function SuggestionsWidget({ tapThrough }: { tapThrough: TapThroughPoint[] | null }) {
  const totalShown = tapThrough?.reduce((s, r) => s + r.prePromptShown, 0) ?? 0;
  const totalConfirmed = tapThrough?.reduce((s, r) => s + r.prePromptConfirmed, 0) ?? 0;
  const avgTtr = totalShown > 0 ? (totalConfirmed / totalShown) * 100 : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50">
          <svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-800">Useful suggestions</p>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Preview</span>
      </div>

      <div className="space-y-3">
        {avgTtr !== null && avgTtr < 30 && (
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-xs font-medium text-amber-800">
              Tap-through rate is below 30% ({fmtPct(avgTtr)}).
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Try refreshing your prompt copy — go to Prompt texts and generate new variants using your keywords and review themes.
            </p>
          </div>
        )}

        {avgTtr !== null && avgTtr >= 30 && (
          <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3">
            <p className="text-xs font-medium text-green-800">
              Strong tap-through rate ({fmtPct(avgTtr)}) — above the 30% benchmark.
            </p>
            <p className="mt-0.5 text-xs text-green-700">
              Consider expanding to additional locales to capture more installs. Check the Geo breakdown in Metrics.
            </p>
          </div>
        )}

        {avgTtr === null && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium text-gray-600">No impressions recorded in the last 30 days.</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Make sure your SDK is initialised and <code className="font-mono">requestReview()</code> is called at a natural high-satisfaction moment.
            </p>
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          Automated suggestions based on conversion patterns, prompt performance, and holdout data are coming in a future update.
        </p>
      </div>
    </div>
  );
}

// ─── Top prompts scaffold ──────────────────────────────────────────────────────

function TopPromptsWidget() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5">
      <div className="mb-2 flex items-center gap-2">
        <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <p className="text-sm font-semibold text-gray-400">Top prompts by tap-through rate</p>
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-400">Coming soon</span>
      </div>
      <p className="text-xs text-gray-400">
        Once per-prompt telemetry is collected, the top 5 active prompt variants ranked by tap-through rate
        and delta vs. holdout baseline will appear here.
      </p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function OverviewClient({ appId }: { appId: string }) {
  const from = isoDate(daysAgo(30));
  const to = isoDate(new Date());

  const [tapThrough, setTapThrough] = useState<TapThroughPoint[] | null>(null);
  const [rpi, setRpi] = useState<RpiSummary | null>(null);
  const [holdoutStats, setHoldoutStats] = useState<HoldoutStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = `/api/app-metrics?appId=${appId}&from=${from}&to=${to}`;
    Promise.all([
      fetch(`${base}&metric=tap_through`).then(r => r.json()),
      fetch(`${base}&metric=reviews_per_install`).then(r => r.json()),
      fetch(`${base}&metric=holdout_stats`).then(r => r.json()),
    ])
      .then(([tap, rpiData, holdout]) => {
        setTapThrough(tap.series ?? []);
        setRpi(rpiData ?? null);
        setHoldoutStats(holdout ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [appId, from, to]);

  // Derive summary numbers from series
  const totalShown = tapThrough?.reduce((s, r) => s + r.prePromptShown, 0) ?? 0;
  const totalConfirmed = tapThrough?.reduce((s, r) => s + r.prePromptConfirmed, 0) ?? 0;
  const avgTtr = totalShown > 0 ? (totalConfirmed / totalShown) * 100 : 0;

  const ttrChartData = (tapThrough ?? []).map(r => ({ date: r.date, value: r.tapThroughRate }));
  const rpiChartData = (rpi?.series ?? []).map(r => ({ date: r.date, value: r.ratio }));

  return (
    <div className="space-y-4">
      {/* 2-col metric widgets */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricWidget
          title="Tap-through rate"
          value={loading ? '—' : fmtPct(avgTtr)}
          subtitle={loading ? '' : `${totalConfirmed.toLocaleString()} confirmed of ${totalShown.toLocaleString()} shown`}
          color="#6366f1"
          data={ttrChartData}
          loading={loading}
        />
        <MetricWidget
          title="Reviews per install"
          value={loading ? '—' : (rpi?.ratio ?? 0).toFixed(2)}
          subtitle={loading ? '' : `${(rpi?.nativePromptRequested ?? 0).toLocaleString()} prompts · ${(rpi?.firstOpen ?? 0).toLocaleString()} installs`}
          color="#10b981"
          data={rpiChartData}
          loading={loading}
        />
      </div>

      {/* Baseline comparison */}
      <BaselineWidget stats={holdoutStats} loading={loading} />

      {/* Useful suggestions */}
      <SuggestionsWidget tapThrough={tapThrough} />

      {/* Top prompts scaffold */}
      <TopPromptsWidget />
    </div>
  );
}
