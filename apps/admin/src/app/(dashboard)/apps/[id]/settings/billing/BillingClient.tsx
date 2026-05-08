'use client';

import { useState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AppSubscription, SubscriptionTier, SubscriptionInvoice } from '@/lib/api';

// ─── Plan definitions ─────────────────────────────────────────────────────────

interface PlanDef {
  tier: SubscriptionTier;
  label: string;
  monthlyPrice: string;
  yearlyPrice: string;
  impressions: string;
  features: string[];
  cta: string;
  highlight: boolean;
}

const PLANS: PlanDef[] = [
  {
    tier: 'indie',
    label: 'Indie',
    monthlyPrice: 'Free',
    yearlyPrice: 'Free',
    impressions: '500 prompt impressions / month',
    features: [
      'Pre-prompt dialog',
      'Holdout baseline',
      'Custom prompt copy',
      'Community support',
    ],
    cta: 'Current plan',
    highlight: false,
  },
  {
    tier: 'startup',
    label: 'Startup',
    monthlyPrice: '$39',
    yearlyPrice: '$31',
    impressions: '10,000 prompt impressions / month',
    features: [
      'Everything in Indie',
      'Analytics CSV export',
      'Geo breakdown',
      'Email support',
    ],
    cta: 'Upgrade to Startup',
    highlight: false,
  },
  {
    tier: 'growth',
    label: 'Growth',
    monthlyPrice: '$99',
    yearlyPrice: '$79',
    impressions: '100,000 prompt impressions / month',
    features: [
      'Everything in Startup',
      'Priority support',
      'Multiple team members',
      'SLA guarantee',
    ],
    cta: 'Upgrade to Growth',
    highlight: true,
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    monthlyPrice: 'Custom',
    yearlyPrice: 'Custom',
    impressions: 'Unlimited prompt impressions',
    features: [
      'Everything in Growth',
      'Dedicated account manager',
      'Custom SLA',
      'Volume discounts',
    ],
    cta: 'Contact us',
    highlight: false,
  },
];

const TIER_ORDER: SubscriptionTier[] = ['indie', 'startup', 'growth', 'enterprise'];

function tierIndex(t: SubscriptionTier) {
  return TIER_ORDER.indexOf(t);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(total: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(total / 100);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-gray-900">{children}</h2>;
}

function Divider() {
  return <hr className="border-gray-100" />;
}

// ─── Current plan card ────────────────────────────────────────────────────────

function CurrentPlanCard({ sub }: { sub: AppSubscription }) {
  const isUnlimited = sub.limit === null;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((sub.impressions / sub.limit!) * 100));
  const isNearLimit = !isUnlimited && pct >= 80;
  const isOverLimit = !isUnlimited && sub.impressions >= sub.limit!;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{sub.tierLabel}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Period: {fmtDate(sub.periodStart)}
            {sub.periodEnd && ` → ${fmtDate(sub.periodEnd)}`}
          </p>
        </div>
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
          {sub.status === 'active' && sub.tier !== 'indie' && (
            <Badge variant="default">Active</Badge>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Prompt impressions this period</span>
          <span className={isOverLimit ? 'text-red-600 font-semibold' : isNearLimit ? 'text-amber-600 font-semibold' : 'font-medium text-gray-700'}>
            {sub.impressions.toLocaleString()}
            {!isUnlimited && ` / ${sub.limit!.toLocaleString()}`}
            {isUnlimited && ' (unlimited)'}
          </span>
        </div>
        {!isUnlimited && (
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-400' : 'bg-brand-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {isOverLimit && (
          <p className="text-xs text-red-600">You have exceeded your monthly prompt impression limit. Upgrade to avoid interruptions.</p>
        )}
      </div>

      {sub.periodEnd && sub.tier !== 'indie' && (
        <p className="text-xs text-gray-400">
          Next billing date: {fmtDate(sub.periodEnd)}
        </p>
      )}
    </div>
  );
}

// ─── Plan grid ────────────────────────────────────────────────────────────────

interface PlanGridProps {
  appId: string;
  currentTier: SubscriptionTier;
  yearly: boolean;
}

function PlanGrid({ appId, currentTier, yearly }: PlanGridProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmTier, setConfirmTier] = useState<SubscriptionTier | null>(null);

  async function handleUpgrade(tier: SubscriptionTier) {
    if (tier === 'enterprise') {
      window.open('mailto:hello@promptsurge.me?subject=Enterprise%20inquiry', '_blank');
      return;
    }
    setConfirmTier(tier);
  }

  async function handleConfirmedUpgrade() {
    if (!confirmTier || confirmTier === 'enterprise') return;
    setConfirmTier(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/app-subscription?appId=${appId}&sub=checkout&tier=${confirmTier}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? data.error ?? 'Failed to create checkout');
        window.location.href = data.checkoutUrl;
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Checkout failed');
      }
    });
  }

  return (
    <>
      {/* Confirmation modal */}
      {confirmTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Confirm upgrade</h3>
            <p className="mt-2 text-sm text-gray-600">
              You are about to subscribe to the <strong>{PLANS.find(p => p.tier === confirmTier)?.label}</strong> plan.
              You will be redirected to our payment provider to complete checkout.
            </p>
            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              All sales are final. PromptSurge does not offer refunds on monthly subscription charges. Cancellations take effect at the end of the current billing period.
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmTier(null)}
                disabled={isPending}
              >
                Go back
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleConfirmedUpgrade}
                disabled={isPending}
              >
                {isPending ? 'Redirecting…' : 'Proceed to checkout'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const isUpgrade = tierIndex(plan.tier) > tierIndex(currentTier);
          const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
          const priceSuffix = plan.tier === 'enterprise' ? '' : plan.monthlyPrice === 'Free' ? '' : yearly ? '/mo billed yearly' : '/mo';

          return (
            <div
              key={plan.tier}
              className={`relative flex flex-col rounded-xl border p-4 ${
                plan.highlight
                  ? 'border-brand-300 bg-brand-50 shadow-sm'
                  : isCurrent
                  ? 'border-gray-300 bg-white'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  Most popular
                </span>
              )}

              <div className="mb-3">
                <p className="text-sm font-semibold text-gray-900">{plan.label}</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold text-gray-900">
                    {yearly && plan.tier !== 'indie' && plan.tier !== 'enterprise' ? (
                      <>
                        <span className="line-through text-gray-400 text-sm font-normal mr-1">{plan.monthlyPrice}</span>
                        {plan.yearlyPrice}
                      </>
                    ) : price}
                  </span>
                  {priceSuffix && (
                    <span className="text-xs text-gray-500">{priceSuffix}</span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">{plan.impressions}</p>
              </div>

              <ul className="mb-4 flex-1 space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 py-1.5 text-center text-xs font-medium text-gray-500">
                  Current plan
                </div>
              ) : yearly && plan.tier !== 'indie' && plan.tier !== 'enterprise' ? (
                <div className="rounded-lg border border-dashed border-gray-200 py-1.5 text-center text-xs text-gray-400">
                  Yearly billing — coming soon
                </div>
              ) : (
                <Button
                  size="sm"
                  variant={isUpgrade ? (plan.highlight ? 'default' : 'outline') : 'ghost'}
                  className="w-full text-xs"
                  onClick={() => handleUpgrade(plan.tier)}
                  disabled={isPending || !isUpgrade}
                >
                  {plan.cta}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Invoices section ─────────────────────────────────────────────────────────

function InvoicesSection({ appId, hasSubscription }: { appId: string; hasSubscription: boolean }) {
  const [invoices, setInvoices] = useState<SubscriptionInvoice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!hasSubscription) return;
    setLoading(true);
    fetch(`/api/app-subscription?appId=${appId}&sub=invoices`)
      .then(r => r.json())
      .then(d => setInvoices(d.invoices ?? []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, [appId, hasSubscription]);

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch(`/api/app-subscription?appId=${appId}&sub=portal`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to open billing portal');
      window.open(data.portalUrl, '_blank');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  if (!hasSubscription) {
    return (
      <p className="text-sm text-gray-400">No invoices — you are on the free Indie plan.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Payment receipts from Lemon Squeezy</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePortal}
          disabled={portalLoading}
          className="text-xs"
        >
          {portalLoading ? 'Opening…' : 'Manage billing & payment →'}
        </Button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      )}

      {!loading && invoices && invoices.length === 0 && (
        <p className="text-sm text-gray-400">No invoices found yet.</p>
      )}

      {!loading && invoices && invoices.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Date</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Description</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Amount</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500">Status</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-500">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={inv.id} className={i !== invoices.length - 1 ? 'border-b border-gray-100' : ''}>
                  <td className="px-4 py-2.5 text-gray-600">{fmtDate(inv.createdAt)}</td>
                  <td className="px-4 py-2.5 text-gray-600 capitalize">{inv.billingReason.replace('_', ' ')}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{fmtCurrency(inv.total, inv.currency)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      inv.status === 'paid'
                        ? 'bg-green-50 text-green-700'
                        : inv.status === 'refunded'
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {inv.invoicePdfUrl ? (
                      <a
                        href={inv.invoicePdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-600 hover:text-brand-700"
                      >
                        Download PDF
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  appId: string;
  initialSubscription: AppSubscription | null;
}

export function BillingClient({ appId, initialSubscription }: Props) {
  const [sub, setSub] = useState<AppSubscription | null>(initialSubscription);
  const [yearly, setYearly] = useState(false);
  const [cancelPending, startCancelTransition] = useTransition();

  const currentTier: SubscriptionTier = sub?.tier ?? 'indie';
  const isPaid = currentTier !== 'indie';
  const canCancel = isPaid && sub?.status === 'active' && !!sub?.lsSubscriptionId;

  async function handleCancel() {
    if (!confirm('Cancel your subscription? Access continues until the end of the current billing period. All sales are final — no refund will be issued.')) return;
    startCancelTransition(async () => {
      try {
        const res = await fetch('/api/app-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, action: 'cancel' }),
        });
        if (!res.ok) throw new Error('Cancellation failed');
        toast.success('Subscription cancelled — active until period end.');
        setSub(s => s ? { ...s, status: 'cancelled' } : s);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Cancellation failed');
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Billing</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage your subscription, invoices, and payment method.</p>
      </div>

      {/* Current plan */}
      {sub && (
        <>
          <div className="space-y-3">
            <SectionTitle>Current plan</SectionTitle>
            <CurrentPlanCard sub={sub} />
          </div>
          <Divider />
        </>
      )}

      {/* Plan comparison */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Plans</SectionTitle>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                !yearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                yearly ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Yearly
              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">−20%</span>
            </button>
          </div>
        </div>

        {yearly && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
            Yearly billing is coming soon. Prices shown are indicative — monthly billing is available now.
          </div>
        )}

        <PlanGrid appId={appId} currentTier={currentTier} yearly={yearly} />

        <p className="text-xs text-gray-400">
          All prices are per app per month, billed in USD. Taxes may apply depending on your location.
          PromptSurge does not offer refunds on subscription charges — cancellations take effect at the end of the current billing period.
        </p>
      </div>

      <Divider />

      {/* Invoices */}
      <div className="space-y-3">
        <SectionTitle>Invoice history</SectionTitle>
        <InvoicesSection appId={appId} hasSubscription={isPaid} />
      </div>

      {/* Danger zone — cancel */}
      {canCancel && (
        <>
          <Divider />
          <div className="space-y-3">
            <SectionTitle>Cancel subscription</SectionTitle>
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 space-y-3">
              <p className="text-sm text-gray-700">
                Cancelling will keep your current plan active until <strong>{sub?.periodEnd ? fmtDate(sub.periodEnd) : 'end of period'}</strong>, after which your app will revert to the Indie (free) tier.
              </p>
              <p className="text-xs text-red-700 font-medium">
                All sales are final. No refund will be issued for the current billing period.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleCancel}
                disabled={cancelPending}
              >
                {cancelPending ? 'Cancelling…' : 'Cancel subscription'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
