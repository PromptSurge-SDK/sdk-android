import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getApp } from '@/lib/api';
import { getSessionToken } from '@/lib/session';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RotateKeyButton } from './RotateKeyButton';

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

  const activeKey = app.activeKeys.find((k) => !k.revokedAt);
  const gracePeriodKey = app.activeKeys.find((k) => k.revokedAt);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-900">Apps</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{app.name}</span>
      </div>

      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{app.name}</h1>
        <Link
          href={`/apps/${app.id}/events`}
          className="text-sm text-brand-600 hover:underline"
        >
          View events →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total events</span>
              <span className="font-medium">{app.eventCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API keys</span>
              <span className="font-medium">{app.keyCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Created</span>
              <span className="font-medium">{new Date(app.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {activeKey ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Active key</span>
                  <Badge variant="default">Active</Badge>
                </div>
                <code className="block rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                  ps_live_••••••••{activeKey.id.slice(-6)}
                </code>
                <p className="text-xs text-gray-400">
                  Created {new Date(activeKey.createdAt).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <p className="text-gray-500">No active key found.</p>
            )}
            {gracePeriodKey && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                A previous key is in the 7-day grace period (expires{' '}
                {new Date(gracePeriodKey.revokedAt!).toLocaleDateString()}).
              </div>
            )}
            <RotateKeyButton appId={app.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
