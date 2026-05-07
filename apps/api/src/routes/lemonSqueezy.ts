/**
 * Lemon Squeezy webhook handler.
 *
 * Registered as a scoped Fastify plugin so its content-type parser (which
 * captures the raw request body for HMAC verification) does not affect any
 * other routes.
 *
 * Required env vars:
 *   LEMONSQUEEZY_WEBHOOK_SECRET  — signing secret from LS dashboard
 *   LS_VARIANT_STARTUP           — LS variant ID for the Startup tier
 *   LS_VARIANT_GROWTH            — LS variant ID for the Growth tier
 *   LS_VARIANT_ENTERPRISE        — LS variant ID for the Enterprise tier
 *
 * Handled events:
 *   subscription_created   → activate tier, store subscription metadata
 *   subscription_updated   → handle plan change or period rollover
 *   subscription_cancelled → downgrade to indie at period end
 *   subscription_expired   → downgrade to indie immediately
 *   subscription_paused    → mark as paused (impressions still checked)
 *   subscription_resumed   → restore active status
 */

import crypto from 'crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { variantToTier } from '../billing/tiers.js';
import { evictImpressionsCache } from '../billing/impressions.js';

// ─── Payload types (minimal — only what we use) ───────────────────────────────

interface LsSubscriptionAttributes {
  status: string;               // active | past_due | cancelled | paused | expired | on_trial
  variant_id: number;
  customer_id: number;
  user_email?: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  ends_at?: string | null;
}

interface LsWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: { app_id?: string };
  };
  data: {
    id: string;   // LS subscription ID
    attributes: LsSubscriptionAttributes;
  };
}

// ─── HMAC verification ────────────────────────────────────────────────────────

function verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Map LS status string → our SubscriptionStatus enum ──────────────────────

type OurStatus = 'active' | 'past_due' | 'cancelled' | 'paused';

function mapStatus(lsStatus: string): OurStatus {
  switch (lsStatus) {
    case 'active':
    case 'on_trial':   return 'active';
    case 'past_due':
    case 'unpaid':     return 'past_due';
    case 'cancelled':
    case 'expired':    return 'cancelled';
    case 'paused':     return 'paused';
    default:           return 'active';
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export async function registerLsWebhookRoute(app: FastifyInstance): Promise<void> {
  // Override the JSON content-type parser in this scope only so we can read
  // the raw body for signature verification before handing off parsed JSON.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body: Buffer, done) => {
      try {
        (req as unknown as Record<string, unknown>)['rawBody'] = body;
        done(null, JSON.parse(body.toString('utf-8')));
      } catch (err) {
        done(err as Error, null);
      }
    },
  );

  app.post('/webhooks/lemonsqueezy', async (request, reply) => {
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
      request.log.warn('[ls-webhook] LEMONSQUEEZY_WEBHOOK_SECRET not set — rejecting');
      return reply.code(500).send({ error: 'webhook_not_configured' });
    }

    const signature = request.headers['x-signature'];
    if (typeof signature !== 'string') {
      return reply.code(401).send({ error: 'missing_signature' });
    }

    const rawBody = (request as unknown as Record<string, unknown>)['rawBody'] as Buffer | undefined;
    if (!rawBody) {
      return reply.code(400).send({ error: 'missing_body' });
    }

    if (!verifySignature(rawBody, signature, secret)) {
      return reply.code(401).send({ error: 'invalid_signature' });
    }

    const payload = request.body as LsWebhookPayload;
    const eventName = payload.meta.event_name;
    const appId = payload.meta.custom_data?.app_id;
    const lsSubId = payload.data.id;
    const attrs = payload.data.attributes;

    request.log.info({ eventName, appId, lsSubId }, '[ls-webhook] received');

    // Verify the app exists before doing anything
    if (appId) {
      const appRow = await prisma.app.findUnique({ where: { id: appId } });
      if (!appRow) {
        request.log.warn({ appId }, '[ls-webhook] app_id not found — ignoring');
        return reply.code(200).send({ ok: true }); // 200 so LS doesn't retry
      }
    }

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_resumed': {
        const tier = variantToTier(attrs.variant_id);
        if (!tier) {
          request.log.warn({ variant_id: attrs.variant_id }, '[ls-webhook] unknown variant — ignoring');
          break;
        }
        const status = mapStatus(attrs.status);
        const periodStart = attrs.current_period_start ? new Date(attrs.current_period_start) : null;
        const periodEnd   = attrs.current_period_end   ? new Date(attrs.current_period_end)   : null;

        if (appId) {
          await prisma.app.update({
            where: { id: appId },
            data: {
              subscriptionTier:   tier,
              subscriptionStatus: status,
              lsSubscriptionId:   lsSubId,
              lsCustomerId:       String(attrs.customer_id),
              billingPeriodStart: periodStart,
              billingPeriodEnd:   periodEnd,
            },
          });
          evictImpressionsCache(appId);
        } else {
          // Fallback: look up by LS subscription ID (handles updates after initial creation)
          await prisma.app.updateMany({
            where: { lsSubscriptionId: lsSubId },
            data: {
              subscriptionTier:   tier,
              subscriptionStatus: status,
              lsCustomerId:       String(attrs.customer_id),
              billingPeriodStart: periodStart,
              billingPeriodEnd:   periodEnd,
            },
          });
        }
        break;
      }

      case 'subscription_cancelled': {
        // Cancelled means it runs to end of period then expires. Keep tier
        // active until subscription_expired fires; mark status = cancelled
        // so the UI can show a "cancels on X" message.
        await prisma.app.updateMany({
          where: { lsSubscriptionId: lsSubId },
          data: { subscriptionStatus: 'cancelled' },
        });
        break;
      }

      case 'subscription_expired': {
        // Period is over — downgrade to indie immediately.
        const updated = await prisma.app.updateMany({
          where: { lsSubscriptionId: lsSubId },
          data: {
            subscriptionTier:   'indie',
            subscriptionStatus: 'active',
            billingPeriodStart: null,
            billingPeriodEnd:   null,
          },
        });
        // Evict cache for affected apps
        if (updated.count > 0) {
          const affected = await prisma.app.findMany({
            where: { lsSubscriptionId: lsSubId },
            select: { id: true },
          });
          affected.forEach(a => evictImpressionsCache(a.id));
        }
        break;
      }

      case 'subscription_paused': {
        await prisma.app.updateMany({
          where: { lsSubscriptionId: lsSubId },
          data: { subscriptionStatus: 'paused' },
        });
        break;
      }

      default:
        request.log.debug({ eventName }, '[ls-webhook] unhandled event — ignoring');
    }

    return reply.code(200).send({ ok: true });
  });
}
