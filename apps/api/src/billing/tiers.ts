import type { SubscriptionTier } from '@prisma/client';

/** Monthly impression cap per tier (pre_prompt_shown events). */
export const TIER_LIMITS: Record<SubscriptionTier, number> = {
  indie:      2_500,
  startup:    30_000,
  growth:     250_000,
  enterprise: Infinity,
};

/** 10 % overage grace before hard block. */
const GRACE_FACTOR = 1.10;

/** Hard limit including grace allowance. */
export function hardLimit(tier: SubscriptionTier): number {
  const base = TIER_LIMITS[tier];
  return base === Infinity ? Infinity : Math.floor(base * GRACE_FACTOR);
}

/** Human-readable tier label. */
export const TIER_LABEL: Record<SubscriptionTier, string> = {
  indie:      'Indie (free)',
  startup:    'Startup',
  growth:     'Growth',
  enterprise: 'Enterprise',
};

/**
 * Map a Lemon Squeezy variant ID (from env vars) to a SubscriptionTier.
 * Returns null if the variant is unknown.
 */
export function variantToTier(variantId: number | string): SubscriptionTier | null {
  const id = String(variantId);
  if (process.env.LS_VARIANT_STARTUP && id === process.env.LS_VARIANT_STARTUP) return 'startup';
  if (process.env.LS_VARIANT_GROWTH  && id === process.env.LS_VARIANT_GROWTH)  return 'growth';
  if (process.env.LS_VARIANT_ENTERPRISE && id === process.env.LS_VARIANT_ENTERPRISE) return 'enterprise';
  return null;
}

/**
 * Variant ID for a given tier (reverse lookup for checkout URL generation).
 */
export function tierToVariantId(tier: SubscriptionTier): string | null {
  switch (tier) {
    case 'startup':    return process.env.LS_VARIANT_STARTUP    ?? null;
    case 'growth':     return process.env.LS_VARIANT_GROWTH     ?? null;
    case 'enterprise': return process.env.LS_VARIANT_ENTERPRISE ?? null;
    default:           return null;
  }
}

/**
 * Start of the current billing period for an app.
 * - If the app has a LS-managed billingPeriodStart, use it.
 * - Otherwise, fall back to the first day of the current UTC calendar month.
 */
export function currentPeriodStart(app: { billingPeriodStart: Date | null }): Date {
  if (app.billingPeriodStart) return app.billingPeriodStart;
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
