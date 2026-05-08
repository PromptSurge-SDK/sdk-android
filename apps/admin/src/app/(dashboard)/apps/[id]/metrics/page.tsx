import { notFound, redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';
import { getApp, getKeywords, getPrompts, ApiError } from '@/lib/api';
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

  const [keywords, prompts] = await Promise.all([
    getKeywords(token, params.id).catch(() => []),
    getPrompts(token, params.id).catch(() => []),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Metrics</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Prompt impressions, tap-through rates, and install conversion — {appName}
        </p>
      </div>

      <MetricsClient appId={params.id} keywords={keywords} prompts={prompts} />
    </div>
  );
}
