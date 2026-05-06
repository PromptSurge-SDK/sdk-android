import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getApps } from '@/lib/api';
import { getSessionToken } from '@/lib/session';
import { Badge } from '@/components/ui/badge';
import { CreateAppButton } from './CreateAppButton';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let apps: Awaited<ReturnType<typeof getApps>> = [];
  try {
    apps = await getApps(token);
  } catch {
    redirect('/login');
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your apps</h1>
          <p className="text-sm text-gray-500">
            {apps.length === 0 ? 'No apps yet' : `${apps.length} app${apps.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <CreateAppButton />
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
            <svg className="h-7 w-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Create your first app</h2>
          <p className="mb-6 max-w-xs text-sm text-gray-500">
            Each app gets its own API key. Integrate the SDK into your Android app using that key.
          </p>
          <CreateAppButton />
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/apps/${app.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-brand-300 hover:shadow"
            >
              <div>
                <div className="font-medium text-gray-900">{app.name}</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  Created {new Date(app.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{app.eventCount.toLocaleString()} events</Badge>
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
