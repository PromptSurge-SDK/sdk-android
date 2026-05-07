/**
 * M7 Metrics endpoints.
 *
 * Queries run against SQL views created in migration 20260509000000_m7_metrics_views:
 *   - event_daily_rollup  (per appId, date, resolvedLocale, appVersion)
 *   - tap_through_daily   (derived: tap-through rate)
 *
 * Performance note: views aggregate the raw Event table. With the index on
 * (appId, eventType, timestamp) Postgres uses an index scan. Revisit with
 * materialized views + pg_cron refresh if the Event table grows past ~10M rows.
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

async function queryTapThrough(appId: string, from: Date, to: Date, version?: string): Promise<TapThroughRow[]> {
  if (version) {
    return prisma.$queryRaw<TapThroughRow[]>`
      SELECT date::date AS date,
        SUM("prePromptShown")::bigint AS "prePromptShown",
        SUM("prePromptConfirmed")::bigint AS "prePromptConfirmed",
        SUM("prePromptDismissed")::bigint AS "prePromptDismissed",
        CASE WHEN SUM("prePromptShown") > 0
          THEN ROUND((SUM("prePromptConfirmed")::numeric / SUM("prePromptShown")::numeric) * 100, 2)
          ELSE 0 END AS "tapThroughRate"
      FROM tap_through_daily
      WHERE "appId" = ${appId} AND date >= ${from} AND date <= ${to} AND "appVersion" = ${version}
      GROUP BY date::date ORDER BY date::date
    `;
  }
  return prisma.$queryRaw<TapThroughRow[]>`
    SELECT date::date AS date,
      SUM("prePromptShown")::bigint AS "prePromptShown",
      SUM("prePromptConfirmed")::bigint AS "prePromptConfirmed",
      SUM("prePromptDismissed")::bigint AS "prePromptDismissed",
      CASE WHEN SUM("prePromptShown") > 0
        THEN ROUND((SUM("prePromptConfirmed")::numeric / SUM("prePromptShown")::numeric) * 100, 2)
        ELSE 0 END AS "tapThroughRate"
    FROM tap_through_daily
    WHERE "appId" = ${appId} AND date >= ${from} AND date <= ${to}
    GROUP BY date::date ORDER BY date::date
  `;
}

async function queryEventCounts(appId: string, eventType: string, from: Date, to: Date, version?: string): Promise<EventCountRow[]> {
  if (version) {
    return prisma.$queryRaw<EventCountRow[]>`
      SELECT DATE_TRUNC('day', "timestamp")::date AS date, COUNT(*)::bigint AS count
      FROM "Event"
      WHERE "appId" = ${appId} AND "eventType" = ${eventType}
        AND "timestamp" >= ${from} AND "timestamp" <= ${to} AND "appVersion" = ${version}
      GROUP BY DATE_TRUNC('day', "timestamp")::date ORDER BY date
    `;
  }
  return prisma.$queryRaw<EventCountRow[]>`
    SELECT DATE_TRUNC('day', "timestamp")::date AS date, COUNT(*)::bigint AS count
    FROM "Event"
    WHERE "appId" = ${appId} AND "eventType" = ${eventType}
      AND "timestamp" >= ${from} AND "timestamp" <= ${to}
    GROUP BY DATE_TRUNC('day', "timestamp")::date ORDER BY date
  `;
}

async function queryGeo(appId: string, from: Date, to: Date): Promise<GeoRow[]> {
  return prisma.$queryRaw<GeoRow[]>`
    SELECT COALESCE("resolvedLocale", locale) AS "resolvedLocale",
      COUNT(CASE WHEN "eventType" = 'pre_prompt_shown'     THEN 1 END)::bigint AS shown,
      COUNT(CASE WHEN "eventType" = 'pre_prompt_confirmed' THEN 1 END)::bigint AS confirmed
    FROM "Event"
    WHERE "appId" = ${appId} AND "timestamp" >= ${from} AND "timestamp" <= ${to}
    GROUP BY COALESCE("resolvedLocale", locale) ORDER BY shown DESC LIMIT 20
  `;
}

async function queryRpi(appId: string, from: Date, to: Date, version?: string): Promise<RpiRow[]> {
  if (version) {
    return prisma.$queryRaw<RpiRow[]>`
      SELECT DATE_TRUNC('day', "timestamp")::date AS date,
        COUNT(CASE WHEN "eventType" = 'native_prompt_requested' THEN 1 END)::bigint AS "nativePromptRequested",
        COUNT(CASE WHEN "eventType" = 'first_open'              THEN 1 END)::bigint AS "firstOpen"
      FROM "Event"
      WHERE "appId" = ${appId} AND "timestamp" >= ${from} AND "timestamp" <= ${to} AND "appVersion" = ${version}
      GROUP BY DATE_TRUNC('day', "timestamp")::date ORDER BY date
    `;
  }
  return prisma.$queryRaw<RpiRow[]>`
    SELECT DATE_TRUNC('day', "timestamp")::date AS date,
      COUNT(CASE WHEN "eventType" = 'native_prompt_requested' THEN 1 END)::bigint AS "nativePromptRequested",
      COUNT(CASE WHEN "eventType" = 'first_open'              THEN 1 END)::bigint AS "firstOpen"
    FROM "Event"
    WHERE "appId" = ${appId} AND "timestamp" >= ${from} AND "timestamp" <= ${to}
    GROUP BY DATE_TRUNC('day', "timestamp")::date ORDER BY date
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

    if (metric === 'versions') {
      const rows = await prisma.$queryRaw<{ appVersion: string }[]>`
        SELECT DISTINCT "appVersion" FROM "Event" WHERE "appId" = ${appId} ORDER BY "appVersion"
      `;
      return reply.send({ versions: rows.map(r => r.appVersion) });
    }

    if (metric === 'tap_through') {
      const rows = await queryTapThrough(appId, from, to, version);
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
      const rows = await queryEventCounts(appId, eventType, from, to, version);
      return reply.send({
        series: rows.map(r => ({
          date: (r.date as Date).toISOString().split('T')[0],
          count: Number(r.count),
        })),
      });
    }

    if (metric === 'geo_breakdown') {
      const rows = await queryGeo(appId, from, to);
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
      const rows = await queryRpi(appId, from, to, version);
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

    let csv = '';

    if (metric === 'tap_through') {
      const rows = await queryTapThrough(appId, from, to, version);
      const mapped = rows.map(r => ({
        date: (r.date as Date).toISOString().split('T')[0],
        tapThroughRate: Number(r.tapThroughRate),
        prePromptShown: Number(r.prePromptShown),
        prePromptConfirmed: Number(r.prePromptConfirmed),
        prePromptDismissed: Number(r.prePromptDismissed),
      }));
      csv = toCSV(['date', 'tapThroughRate', 'prePromptShown', 'prePromptConfirmed', 'prePromptDismissed'], mapped);
    } else if (metric === 'geo_breakdown') {
      const rows = await queryGeo(appId, from, to);
      const mapped = rows.map(r => ({
        locale: r.resolvedLocale,
        region: regionFromLocale(r.resolvedLocale),
        shown: Number(r.shown),
        confirmed: Number(r.confirmed),
        tapThroughRate: r.shown > 0n ? Math.round((Number(r.confirmed) / Number(r.shown)) * 10000) / 100 : 0,
      }));
      csv = toCSV(['locale', 'region', 'shown', 'confirmed', 'tapThroughRate'], mapped);
    } else if (metric === 'reviews_per_install') {
      const rows = await queryRpi(appId, from, to, version);
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
