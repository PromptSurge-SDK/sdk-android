import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';
import { getApp, ApiError } from '@/lib/api';
import { MetricsClient } from './MetricsClient';

export const dynamic = 'force-dynamic';

export default async function AppMetricsPage({ params }: { params: { id: string } }) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let appName = '';
  try {
    const app = await getApp(token, params.id);
    appName = app.name;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    redirect('/login');
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-900">Apps</Link>
        <span>/</span>
        <Link href={`/apps/${params.id}`} className="hover:text-gray-900">{appName}</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Metrics</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Metrics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Prompt impressions, tap-through rates, and install conversion.
        </p>
      </div>

      <MetricsClient appId={params.id} />
    </div>
  );
}
