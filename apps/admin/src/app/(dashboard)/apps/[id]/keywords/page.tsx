import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';
import { getApp, getKeywords, ApiError } from '@/lib/api';
import { KeywordsClient } from './KeywordsClient';

export const dynamic = 'force-dynamic';

export default async function AppKeywordsPage({ params }: { params: { id: string } }) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let appName = '';
  let keywords: Awaited<ReturnType<typeof getKeywords>> = [];

  try {
    const [app, kws] = await Promise.all([
      getApp(token, params.id),
      getKeywords(token, params.id),
    ]);
    appName = app.name;
    keywords = kws;
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
        <span className="text-gray-900 font-medium">Keywords</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Keywords</h1>
        <p className="mt-1 text-sm text-gray-500">
          Positive keywords guide AI-generated copy. Negative keywords exclude topics. Used when you click "Generate from keywords" on the Prompts page.
        </p>
      </div>

      <KeywordsClient appId={params.id} keywords={keywords} />
    </div>
  );
}
