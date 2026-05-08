import { notFound, redirect } from 'next/navigation';
import { getApp, getSubscription } from '@/lib/api';
import { getSessionToken } from '@/lib/session';
import { OverviewClient } from './OverviewClient';
import { DeleteAppButton } from '@/components/DeleteAppButton';
import { RotateKeyButton } from './RotateKeyButton';
import { SubscriptionBanners } from '@/components/SubscriptionBanners';

export const dynamic = 'force-dynamic';

export default async function AppDetailPage({ params }: { params: { id: string } }) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let app: Awaited<ReturnType<typeof getApp>>;
  try {
    app = await getApp(token, params.id);
  } catch (e: unknown) {
    const status = (e as { status?: number }).status;
    if (status === 404) notFound();
    redirect('/login');
  }

  const subscription = await getSubscription(token, params.id).catch(() => null);

  const activeKey = app.activeKeys.find(k => !k.revokedAt);
  const gracePeriodKey = app.activeKeys.find(k => k.revokedAt);

  return (
    <div className="space-y-6">
      <SubscriptionBanners subscription={subscription} appId={app.id} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Last 30 days · Treatment group</p>
        </div>
        <DeleteAppButton
          appId={app.id}
          appName={app.name}
          variant="full"
          redirectAfterDelete="/dashboard"
        />
      </div>

      <OverviewClient appId={app.id} />

      {/* API key — compact section at bottom */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">API key</p>
        {activeKey ? (
          <div className="flex items-center gap-3">
            <code className="flex-1 rounded border border-gray-200 bg-white px-2 py-1.5 font-mono text-xs text-gray-700">
              ps_live_••••••••{activeKey.id.slice(-6)}
            </code>
            <RotateKeyButton appId={app.id} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No active key.</p>
        )}
        {gracePeriodKey && (
          <p className="mt-2 text-xs text-amber-700">
            Previous key in 7-day grace period — expires {new Date(gracePeriodKey.revokedAt!).toLocaleDateString()}.
          </p>
        )}
      </div>
    </div>
  );
}
