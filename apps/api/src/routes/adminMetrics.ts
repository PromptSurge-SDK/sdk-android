/**
 * M7+ Metrics endpoints.
 *
 * All queries support a `group` parameter: 'treatment' (default) | 'holdout'.
 * - treatment: holdout=false events only (devices that saw the pre-prompt)
 * - holdout:   holdout=true events only  (control group; no pre-prompt shown)
 *
 * The tap_through metric previously used the tap_through_daily SQL view. It now
 * queries the Event table directly so it can filter by holdout group. The view
 * remains in the DB but is no longer used here.
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { assertAppAccess } from '../auth/appAccess.js';

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function regionFromLocale(locale: string): string {
  const parts = locale.split('-');
  return parts.length >= 2 ? parts[parts.length - 1].toUpperCase() : locale;
}

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map(h => escape(row[h])).join(','));
  return lines.join('\n');
}

type TapThroughRow = { date: Date; tapThroughRate: number; prePromptShown: bigint; prePromptConfirmed: bigint; prePromptDismissed: bigint; };
type EventCountRow = { date: Date; count: bigint };
type GeoRow = { resolvedLocale: string; shown: bigint; confirmed: bigint };
type RpiRow = { date: Date; nativePromptRequested: bigint; firstOpen: bigint };
type HoldoutStatsRow = { holdout: boolean; deviceCount: bigint; nativeCount: bigint; firstOpenCount: bigint };

async function queryTapThrough(appId: string, from: Date, to: Date, holdout: boolean, version?: string): Promise<TapThroughRow[]> {
  if (version) {
    return prisma.$queryRaw<TapThroughRow[]>`
      SELECT DATE_TRUNC('day', "timestamp")::date AS date,
        COUNT(CASE WHEN "eventType" = 'pre_prompt_shown'     THEN 1 END)::bigint AS "prePromptShown",
        COUNT(CASE WHEN "eventType" = 'pre_prompt_confirmed' THEN 1 END)::bigint AS "prePromptConfirmed",
        COUNT(CASE WHEN "eventType" = 'pre_prompt_dismissed' THEN 1 END)::bigint AS "prePromptDismissed",
        CASE WHEN COUNT(CASE WHEN "eventType" = 'pre_prompt_shown' THEN 1 END) > 0
          THEN ROUND(
            COUNT(CASE WHEN "eventType" = 'pre_prompt_confirmed' THEN 1 END)::numeric /
            COUNT(CASE WHEN "eventType" = 'pre_prompt_shown'     THEN 1 END)::numeric * 100, 2)
          ELSE 0 END AS "tapThroughRate"
      FROM "Event"
      WHERE "appId" = ${appId} AND "holdout" = ${holdout}
        AND "timestamp" >= ${from} AND "timestamp" <= ${to}
        AND "appVersion" = ${version}
      GROUP BY DATE_TRUNC('day', "timestamp")::date ORDER BY date
    `;
  }
  return prisma.$queryRaw<TapThroughRow[]>`
    SELECT DATE_TRUNC('day', "timestamp")::date AS date,
      COUNT(CASE WHEN "eventType" = 'pre_prompt_shown'     THEN 1 END)::bigint AS "prePromptShown",
      COUNT(CASE WHEN "eventType" = 'pre_prompt_confirmed' THEN 1 END)::bigint AS "prePromptConfirmed",
      COUNT(CASE WHEN "eventType" = 'pre_prompt_dismissed' THEN 1 END)::bigint AS "prePromptDismissed",
      CASE WHEN COUNT(CASE WHEN "eventType" = 'pre_prompt_shown' THEN 1 END) > 0
        THEN ROUND(
          COUNT(CASE WHEN "eventType" = 'pre_prompt_confirmed' THEN 1 END)::numeric /
          COUNT(CASE WHEN "eventType" = 'pre_prompt_shown'     THEN 1 END)::numeric * 100, 2)
        ELSE 0 END AS "tapThroughRate"
    FROM "Event"
    WHERE "appId" = ${appId} AND "holdout" = ${holdout}
      AND "timestamp" >= ${from} AND "timestamp" <= ${to}
    GROUP BY DATE_TRUNC('day', "timestamp")::date ORDER BY date
  `;
}

async function queryEventCounts(appId: string, eventType: string, from: Date, to: Date, holdout: boolean, version?: string): Promise<EventCountRow[]> {
  if (version) {
    return prisma.$queryRaw<EventCountRow[]>`
      SELECT DATE_TRUNC('day', "timestamp")::date AS date, COUNT(*)::bigint AS count
      FROM "Event"
      WHERE "appId" = ${appId} AND "eventType" = ${eventType} AND "holdout" = ${holdout}
        AND "timestamp" >= ${from} AND "timestamp" <= ${to} AND "appVersion" = ${version}
      GROUP BY DATE_TRUNC('day', "timestamp")::date ORDER BY date
    `;
  }
  return prisma.$queryRaw<EventCountRow[]>`
    SELECT DATE_TRUNC('day', "timestamp")::date AS date, COUNT(*)::bigint AS count
    FROM "Event"
    WHERE "appId" = ${appId} AND "eventType" = ${eventType} AND "holdout" = ${holdout}
      AND "timestamp" >= ${from} AND "timestamp" <= ${to}
    GROUP BY DATE_TRUNC('day', "timestamp")::date ORDER BY date
  `;
}

async function queryGeo(appId: string, from: Date, to: Date, holdout: boolean): Promise<GeoRow[]> {
  return prisma.$queryRaw<GeoRow[]>`
    SELECT COALESCE("resolvedLocale", locale) AS "resolvedLocale",
      COUNT(CASE WHEN "eventType" = 'pre_prompt_shown'     THEN 1 END)::bigint AS shown,
      COUNT(CASE WHEN "eventType" = 'pre_prompt_confirmed' THEN 1 END)::bigint AS confirmed
    FROM "Event"
    WHERE "appId" = ${appId} AND "holdout" = ${holdout}
      AND "timestamp" >= ${from} AND "timestamp" <= ${to}
    GROUP BY COALESCE("resolvedLocale", locale) ORDER BY shown DESC LIMIT 20
  `;
}

async function queryRpi(appId: string, from: Date, to: Date, holdout: boolean, version?: string): Promise<RpiRow[]> {
  if (version) {
    return prisma.$queryRaw<RpiRow[]>`
      SELECT DATE_TRUNC('day', "timestamp")::date AS date,
        COUNT(CASE WHEN "eventType" = 'native_prompt_requested' THEN 1 END)::bigint AS "nativePromptRequested",
        COUNT(CASE WHEN "eventType" = 'first_open'              THEN 1 END)::bigint AS "firstOpen"
      FROM "Event"
      WHERE "appId" = ${appId} AND "holdout" = ${holdout}
        AND "timestamp" >= ${from} AND "timestamp" <= ${to} AND "appVersion" = ${version}
      GROUP BY DATE_TRUNC('day', "timestamp")::date ORDER BY date
    `;
  }
  return prisma.$queryRaw<RpiRow[]>`
    SELECT DATE_TRUNC('day', "timestamp")::date AS date,
      COUNT(CASE WHEN "eventType" = 'native_prompt_requested' THEN 1 END)::bigint AS "nativePromptRequested",
      COUNT(CASE WHEN "eventType" = 'first_open'              THEN 1 END)::bigint AS "firstOpen"
    FROM "Event"
    WHERE "appId" = ${appId} AND "holdout" = ${holdout}
      AND "timestamp" >= ${from} AND "timestamp" <= ${to}
    GROUP BY DATE_TRUNC('day', "timestamp")::date ORDER BY date
  `;
}

// Aggregate comparison across both groups for the overview dashboard baseline widget.
async function queryHoldoutStats(appId: string, from: Date, to: Date): Promise<HoldoutStatsRow[]> {
  return prisma.$queryRaw<HoldoutStatsRow[]>`
    SELECT
      "holdout",
      COUNT(DISTINCT "deviceId")::bigint                                          AS "deviceCount",
      COUNT(CASE WHEN "eventType" = 'native_prompt_requested' THEN 1 END)::bigint AS "nativeCount",
      COUNT(CASE WHEN "eventType" = 'first_open'              THEN 1 END)::bigint AS "firstOpenCount"
    FROM "Event"
    WHERE "appId" = ${appId} AND "timestamp" >= ${from} AND "timestamp" <= ${to}
    GROUP BY "holdout"
  `;
}

export async function registerAdminMetricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/apps/:appId/metrics', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const q = request.query as Record<string, string>;
    const metric = q.metric ?? 'tap_through';
    const from = parseDate(q.from, daysAgo(30));
    const to = parseDate(q.to, new Date());
    const version = q.version || undefined;
    // group defaults to treatment; holdout group is opted-in explicitly
    const holdout = q.group === 'holdout';

    if (metric === 'versions') {
      const rows = await prisma.$queryRaw<{ appVersion: string }[]>`
        SELECT DISTINCT "appVersion" FROM "Event" WHERE "appId" = ${appId} ORDER BY "appVersion"
      `;
      return reply.send({ versions: rows.map(r => r.appVersion) });
    }

    if (metric === 'tap_through') {
      const rows = await queryTapThrough(appId, from, to, holdout, version);
      return reply.send({
        series: rows.map(r => ({
          date: (r.date as Date).toISOString().split('T')[0],
          tapThroughRate: Number(r.tapThroughRate),
          prePromptShown: Number(r.prePromptShown),
          prePromptConfirmed: Number(r.prePromptConfirmed),
          prePromptDismissed: Number(r.prePromptDismissed),
        })),
      });
    }

    if (metric === 'event_counts') {
      const eventType = q.eventType ?? 'pre_prompt_shown';
      const rows = await queryEventCounts(appId, eventType, from, to, holdout, version);
      return reply.send({
        series: rows.map(r => ({
          date: (r.date as Date).toISOString().split('T')[0],
          count: Number(r.count),
        })),
      });
    }

    if (metric === 'geo_breakdown') {
      const rows = await queryGeo(appId, from, to, holdout);
      return reply.send({
        rows: rows.map(r => ({
          locale: r.resolvedLocale,
          region: regionFromLocale(r.resolvedLocale),
          shown: Number(r.shown),
          confirmed: Number(r.confirmed),
          tapThroughRate: r.shown > 0n
            ? Math.round((Number(r.confirmed) / Number(r.shown)) * 10000) / 100 : 0,
        })),
      });
    }

    if (metric === 'reviews_per_install') {
      const rows = await queryRpi(appId, from, to, holdout, version);
      const series = rows.map(r => ({
        date: (r.date as Date).toISOString().split('T')[0],
        nativePromptRequested: Number(r.nativePromptRequested),
        firstOpen: Number(r.firstOpen),
        ratio: r.firstOpen > 0n
          ? Math.round((Number(r.nativePromptRequested) / Number(r.firstOpen)) * 100) / 100 : 0,
      }));
      const totalNative = series.reduce((s, r) => s + r.nativePromptRequested, 0);
      const totalInstalls = series.reduce((s, r) => s + r.firstOpen, 0);
      return reply.send({
        nativePromptRequested: totalNative,
        firstOpen: totalInstalls,
        ratio: totalInstalls > 0 ? Math.round((totalNative / totalInstalls) * 100) / 100 : 0,
        series,
      });
    }

    // Returns aggregate stats for both groups — used by the overview baseline comparison widget.
    // Response: { hasBaseline, treatment: { devices, nativeRate }, holdout: { devices, nativeRate } }
    if (metric === 'holdout_stats') {
      const rows = await queryHoldoutStats(appId, from, to);
      const byGroup = (h: boolean) => rows.find(r => r.holdout === h);
      const BASELINE_MIN_DEVICES = 50;

      const treatRow = byGroup(false);
      const holdRow  = byGroup(true);

      const treatDevices = Number(treatRow?.deviceCount ?? 0n);
      const holdDevices  = Number(holdRow?.deviceCount  ?? 0n);

      const nativeRate = (row: HoldoutStatsRow | undefined) => {
        if (!row || row.firstOpenCount === 0n) return 0;
        return Math.round((Number(row.nativeCount) / Number(row.firstOpenCount)) * 10000) / 100;
      };

      return reply.send({
        hasBaseline: holdDevices >= BASELINE_MIN_DEVICES,
        treatment: { devices: treatDevices, nativeRate: nativeRate(treatRow) },
        holdout:   { devices: holdDevices,  nativeRate: nativeRate(holdRow)  },
      });
    }

    return reply.code(400).send({ error: 'unknown_metric' });
  });

  // CSV export
  app.get('/admin/apps/:appId/metrics/export.csv', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const q = request.query as Record<string, string>;
    const metric = q.metric ?? 'tap_through';
    const from = parseDate(q.from, daysAgo(30));
    const to = parseDate(q.to, new Date());
    const version = q.version || undefined;
    const holdout = q.group === 'holdout';

    let csv = '';

    if (metric === 'tap_through') {
      const rows = await queryTapThrough(appId, from, to, holdout, version);
      const mapped = rows.map(r => ({
        date: (r.date as Date).toISOString().split('T')[0],
        tapThroughRate: Number(r.tapThroughRate),
        prePromptShown: Number(r.prePromptShown),
        prePromptConfirmed: Number(r.prePromptConfirmed),
        prePromptDismissed: Number(r.prePromptDismissed),
      }));
      csv = toCSV(['date', 'tapThroughRate', 'prePromptShown', 'prePromptConfirmed', 'prePromptDismissed'], mapped);
    } else if (metric === 'geo_breakdown') {
      const rows = await queryGeo(appId, from, to, holdout);
      const mapped = rows.map(r => ({
        locale: r.resolvedLocale,
        region: regionFromLocale(r.resolvedLocale),
        shown: Number(r.shown),
        confirmed: Number(r.confirmed),
        tapThroughRate: r.shown > 0n ? Math.round((Number(r.confirmed) / Number(r.shown)) * 10000) / 100 : 0,
      }));
      csv = toCSV(['locale', 'region', 'shown', 'confirmed', 'tapThroughRate'], mapped);
    } else if (metric === 'reviews_per_install') {
      const rows = await queryRpi(appId, from, to, holdout, version);
      const mapped = rows.map(r => ({
        date: (r.date as Date).toISOString().split('T')[0],
        nativePromptRequested: Number(r.nativePromptRequested),
        firstOpen: Number(r.firstOpen),
        ratio: r.firstOpen > 0n ? Math.round((Number(r.nativePromptRequested) / Number(r.firstOpen)) * 100) / 100 : 0,
      }));
      csv = toCSV(['date', 'nativePromptRequested', 'firstOpen', 'ratio'], mapped);
    } else {
      return reply.code(400).send({ error: 'unsupported_metric_for_export' });
    }

    const filename = `${metric}_${from.toISOString().split('T')[0]}_${to.toISOString().split('T')[0]}.csv`;
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(csv);
  });
}
