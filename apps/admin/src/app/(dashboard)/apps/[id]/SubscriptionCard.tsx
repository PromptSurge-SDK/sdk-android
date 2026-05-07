'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AppSubscription, SubscriptionTier } from '@/lib/api';

interface Props {
  appId: string;
  initial: AppSubscription;
}

const TIER_BADGE: Record<string, 'default' | 'secondary' | 'outline'> = {
  indie:      'outline',
  startup:    'secondary',
  growth:     'default',
  enterprise: 'default',
};

const TIER_COLOR: Record<string, string> = {
  indie:      'text-gray-500',
  startup:    'text-brand-700',
  growth:     'text-brand-700',
  enterprise: 'text-brand-700',
};

const UPGRADE_TIERS: { tier: SubscriptionTier; label: string; price: string }[] = [
  { tier: 'startup',    label: 'Startup',    price: '$39 / app / month' },
  { tier: 'growth',     label: 'Growth',     price: '$99 / app / month' },
  { tier: 'enterprise', label: 'Enterprise', price: 'Custom' },
];

export function SubscriptionCard({ appId, initial }: Props) {
  const [sub, setSub] = useState<AppSubscription>(initial);
  const [isPending, startTransition] = useTransition();

  const isUnlimited = sub.limit === null;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((sub.impressions / sub.limit!) * 100));
  const isNearLimit = !isUnlimited && pct >= 80;
  const isOverLimit = !isUnlimited && sub.impressions >= sub.limit!;

  async function handleUpgrade(tier: SubscriptionTier) {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/app-subscription?appId=${appId}&sub=checkout&tier=${tier}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to create checkout');
        window.location.href = data.checkoutUrl;
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Checkout failed');
      }
    });
  }

  async function handleCancel() {
    if (!confirm('Cancel your subscription? Your plan stays active until the end of the billing period.')) return;
    startTransition(async () => {
      try {
        const res = await fetch('/api/app-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, action: 'cancel' }),
        });
        if (!res.ok) throw new Error('Cancellation failed');
        toast.success('Subscription cancelled — active until period end.');
        setSub(s => ({ ...s, status: 'cancelled' }));
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Cancellation failed');
      }
    });
  }

  return (
    <Card className={isOverLimit ? 'border-red-300' : isNearLimit ? 'border-amber-300' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Subscription</span>
          <div className="flex items-center gap-2">
            {sub.status === 'cancelled' && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">Cancels at period end</Badge>
            )}
            {sub.status === 'past_due' && (
              <Badge variant="outline" className="text-red-600 border-red-300">Past due</Badge>
            )}
            {sub.status === 'paused' && (
              <Badge variant="outline" className="text-gray-500">Paused</Badge>
            )}
            <Badge variant={TIER_BADGE[sub.tier] ?? 'outline'}>
              {sub.tierLabel}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {/* Impression usage */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Impressions this period</span>
            <span className={isOverLimit ? 'text-red-600 font-semibold' : isNearLimit ? 'text-amber-600 font-semibold' : ''}>
              {sub.impressions.toLocaleString()}
              {!isUnlimited && ` / ${sub.limit!.toLocaleString()}`}
              {isUnlimited && ' (unlimited)'}
            </span>
          </div>
          {!isUnlimited && (
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-400' : 'bg-brand-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {sub.periodEnd && (
            <p className="text-xs text-gray-400">
              Period ends {new Date(sub.periodEnd).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Upgrade options (shown when not enterprise) */}
        {sub.tier !== 'enterprise' && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-gray-600">Upgrade this app</p>
            <div className="grid gap-2">
              {UPGRADE_TIERS.filter(t => {
                const order = ['indie', 'startup', 'growth', 'enterprise'];
                return order.indexOf(t.tier) > order.indexOf(sub.tier);
              }).map(({ tier, label, price }) => (
                <button
                  key={tier}
                  onClick={() => handleUpgrade(tier)}
                  disabled={isPending}
                  className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-left text-xs hover:bg-brand-100 disabled:opacity-50 transition-colors"
                >
                  <span className={`font-medium ${TIER_COLOR[tier]}`}>{label}</span>
                  <span className="text-gray-500">{price} →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cancel link (only for paid, active subscriptions) */}
        {sub.tier !== 'indie' && sub.status === 'active' && sub.lsSubscriptionId && (
          <div className="border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-400 hover:text-red-500 px-0"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel subscription
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
