import Link from 'next/link';
import type { AppSubscription } from '@/lib/api';

interface Props {
  subscription: AppSubscription | null;
  appId: string;
}

interface Banner {
  level: 'error' | 'warning' | 'info';
  message: React.ReactNode;
}

function buildBanners(subscription: AppSubscription | null, appId: string): Banner[] {
  if (!subscription) return [];

  const banners: Banner[] = [];
  const billingHref = `/apps/${appId}/settings/billing`;

  if (subscription.status === 'past_due') {
    banners.push({
      level: 'error',
      message: (
        <>
          <strong>Payment failed.</strong> Please{' '}
          <Link href={billingHref} className="underline font-medium">update your payment method</Link>
          {' '}to keep your plan active.
        </>
      ),
    });
  }

  if (subscription.status === 'cancelled') {
    const endsOn = subscription.periodEnd
      ? new Date(subscription.periodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
    banners.push({
      level: 'warning',
      message: (
        <>
          <strong>Subscription cancelled.</strong>{' '}
          {endsOn ? `Your plan remains active until ${endsOn}.` : 'Your plan will end at the close of the current period.'}{' '}
          <Link href={billingHref} className="underline font-medium">Reactivate</Link>
        </>
      ),
    });
  }

  // Downgraded to indie after having had a paid subscription (lsSubscriptionId present but tier is indie)
  if (
    subscription.tier === 'indie' &&
    subscription.lsSubscriptionId !== null &&
    subscription.status === 'active'
  ) {
    banners.push({
      level: 'info',
      message: (
        <>
          <strong>Plan ended.</strong> You&apos;ve been moved to the free plan.{' '}
          <Link href={billingHref} className="underline font-medium">Upgrade</Link>
          {' '}to restore full access.
        </>
      ),
    });
  }

  if (subscription.limit !== null && subscription.limit > 0) {
    const pct = Math.round((subscription.impressions / subscription.limit) * 100);
    if (pct >= 100) {
      banners.push({
        level: 'error',
        message: (
          <>
            <strong>Prompt impression limit reached.</strong> The pre-prompt is paused for new users this period.{' '}
            <Link href={billingHref} className="underline font-medium">Upgrade your plan</Link>
            {' '}to restore delivery.
          </>
        ),
      });
    } else if (pct >= 80) {
      banners.push({
        level: 'warning',
        message: (
          <>
            <strong>Approaching prompt impression limit.</strong> You&apos;ve used{' '}
            {subscription.impressions.toLocaleString()} of {subscription.limit.toLocaleString()} prompt impressions ({pct}%) this period.{' '}
            <Link href={billingHref} className="underline font-medium">Upgrade</Link>
            {' '}to avoid interruption.
          </>
        ),
      });
    }
  }

  return banners;
}

const levelStyles: Record<Banner['level'], string> = {
  error:   'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info:    'bg-blue-50 border-blue-200 text-blue-800',
};

const levelIcons: Record<Banner['level'], string> = {
  error:   'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

export function SubscriptionBanners({ subscription, appId }: Props) {
  const banners = buildBanners(subscription, appId);
  if (banners.length === 0) return null;

  return (
    <div className="space-y-2">
      {banners.map((b, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${levelStyles[b.level]}`}
        >
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 opacity-70"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={levelIcons[b.level]} />
          </svg>
          <p className="leading-snug">{b.message}</p>
        </div>
      ))}
    </div>
  );
}
