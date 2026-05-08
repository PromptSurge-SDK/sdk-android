/**
 * Admin subscription routes.
 *
 * GET  /admin/apps/:appId/subscription
 *   Returns current tier, status, impression usage, and limits.
 *
 * GET  /admin/apps/:appId/subscription/checkout?tier=startup|growth|enterprise
 *   Creates a Lemon Squeezy checkout session and returns the checkout URL.
 *   Requires LS_API_KEY + LS_STORE_ID env vars.
 *
 * POST /admin/apps/:appId/subscription/cancel
 *   Cancels the active LS subscription (calls LS API).
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { assertAppAccess } from '../auth/appAccess.js';
import {
  TIER_LIMITS,
  TIER_LABEL,
  tierToVariantId,
  currentPeriodStart,
} from '../billing/tiers.js';
import { getMonthlyImpressions } from '../billing/impressions.js';


// ─── Lemon Squeezy API helpers ────────────────────────────────────────────────

const LS_API_BASE = 'https://api.lemonsqueezy.com/v1';

async function lsRequest(method: string, path: string, body?: unknown) {
  const apiKey = process.env.LS_API_KEY;
  if (!apiKey) throw new Error('LS_API_KEY not configured');

  const res = await fetch(`${LS_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LS API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function createCheckout(
  variantId: string,
  developerEmail: string,
  appId: string,
): Promise<string> {
  const storeId = process.env.LS_STORE_ID;
  if (!storeId) throw new Error('LS_STORE_ID not configured');

  const data = await lsRequest('POST', '/checkouts', {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: developerEmail,
          custom: { app_id: appId },
        },
      },
      relationships: {
        store:   { data: { type: 'stores',   id: storeId   } },
        variant: { data: { type: 'variants', id: variantId } },
      },
    },
  });

  const url = data?.data?.attributes?.url;
  if (typeof url !== 'string') throw new Error('LS did not return a checkout URL');
  return url;
}

async function cancelLsSubscription(lsSubscriptionId: string): Promise<void> {
  await lsRequest('DELETE', `/subscriptions/${lsSubscriptionId}`);
}

async function getLsPortalUrl(lsSubscriptionId: string): Promise<string> {
  const data = await lsRequest('GET', `/subscriptions/${lsSubscriptionId}`);
  const url = data?.data?.attributes?.urls?.customer_portal;
  if (typeof url !== 'string') throw new Error('LS did not return a customer portal URL');
  return url;
}

interface LsInvoice {
  id: string;
  billingReason: string;
  createdAt: string;
  total: number;
  currency: string;
  status: string;
  invoicePdfUrl: string | null;
}

async function getLsInvoices(lsSubscriptionId: string): Promise<LsInvoice[]> {
  const data = await lsRequest('GET', `/subscription-invoices?filter[subscription_id]=${lsSubscriptionId}&sort=-created_at&page[size]=24`);
  const items: unknown[] = Array.isArray(data?.data) ? data.data : [];
  return items.map((item: unknown) => {
    const i = item as Record<string, unknown>;
    const attrs = (i.attributes ?? {}) as Record<string, unknown>;
    const urls = (attrs.urls ?? {}) as Record<string, unknown>;
    return {
      id: String(i.id ?? ''),
      billingReason: String(attrs.billing_reason ?? 'renewal'),
      createdAt: String(attrs.created_at ?? ''),
      total: Number(attrs.total ?? 0),
      currency: String(attrs.currency ?? 'USD'),
      status: String(attrs.status ?? 'paid'),
      invoicePdfUrl: typeof urls.invoice_pdf === 'string' ? urls.invoice_pdf : null,
    };
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function registerAdminSubscriptionRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/apps/:appId/subscription
  app.get('/admin/apps/:appId/subscription', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;

    const appRow = await assertAppAccess(appId, dev.id);
    if (!appRow) return reply.code(404).send({ error: 'app_not_found' });

    const periodStart = currentPeriodStart(appRow);
    const impressions = await getMonthlyImpressions(appId, periodStart);
    const limit       = TIER_LIMITS[appRow.subscriptionTier];

    return reply.send({
      tier:             appRow.subscriptionTier,
      tierLabel:        TIER_LABEL[appRow.subscriptionTier],
      status:           appRow.subscriptionStatus,
      impressions,
      limit:            limit === Infinity ? null : limit,
      periodStart:      periodStart.toISOString(),
      periodEnd:        appRow.billingPeriodEnd?.toISOString() ?? null,
      lsSubscriptionId: appRow.lsSubscriptionId ?? null,
    });
  });

  // GET /admin/apps/:appId/subscription/checkout?tier=startup|growth|enterprise
  app.get('/admin/apps/:appId/subscription/checkout', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    const { tier } = request.query as { tier?: string };

    if (!tier || !['startup', 'growth', 'enterprise'].includes(tier)) {
      return reply.code(400).send({ error: 'invalid_tier', valid: ['startup', 'growth', 'enterprise'] });
    }

    const appRow = await assertAppAccess(appId, dev.id);
    if (!appRow) return reply.code(404).send({ error: 'app_not_found' });

    const variantId = tierToVariantId(tier as 'startup' | 'growth' | 'enterprise');
    if (!variantId) {
      return reply.code(501).send({ error: 'billing_not_configured', message: `LS_VARIANT_${tier.toUpperCase()} env var not set` });
    }

    try {
      const checkoutUrl = await createCheckout(variantId, dev.email, appId);
      return reply.send({ checkoutUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, '[subscription] checkout URL generation failed');
      return reply.code(502).send({ error: 'checkout_failed', message });
    }
  });

  // GET /admin/apps/:appId/subscription/portal
  app.get('/admin/apps/:appId/subscription/portal', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;

    const appRow = await assertAppAccess(appId, dev.id);
    if (!appRow) return reply.code(404).send({ error: 'app_not_found' });
    if (!appRow.lsSubscriptionId) return reply.code(400).send({ error: 'no_active_subscription' });

    try {
      const portalUrl = await getLsPortalUrl(appRow.lsSubscriptionId);
      return reply.send({ portalUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, '[subscription] portal URL fetch failed');
      return reply.code(502).send({ error: 'portal_failed', message });
    }
  });

  // GET /admin/apps/:appId/subscription/invoices
  app.get('/admin/apps/:appId/subscription/invoices', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;

    const appRow = await assertAppAccess(appId, dev.id);
    if (!appRow) return reply.code(404).send({ error: 'app_not_found' });
    if (!appRow.lsSubscriptionId) return reply.send({ invoices: [] });

    try {
      const invoices = await getLsInvoices(appRow.lsSubscriptionId);
      return reply.send({ invoices });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, '[subscription] invoices fetch failed');
      return reply.code(502).send({ error: 'invoices_failed', message });
    }
  });

  // POST /admin/apps/:appId/subscription/cancel
  app.post('/admin/apps/:appId/subscription/cancel', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;

    const appRow = await assertAppAccess(appId, dev.id);
    if (!appRow) return reply.code(404).send({ error: 'app_not_found' });

    if (!appRow.lsSubscriptionId) {
      return reply.code(400).send({ error: 'no_active_subscription' });
    }

    try {
      await cancelLsSubscription(appRow.lsSubscriptionId);
      // LS will send a subscription_cancelled webhook which updates the DB;
      // optimistically mark cancelled here so the UI reflects immediately.
      await prisma.app.update({
        where: { id: appId },
        data: { subscriptionStatus: 'cancelled' },
      });
      return reply.send({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, '[subscription] cancel failed');
      return reply.code(502).send({ error: 'cancel_failed', message });
    }
  });
}
