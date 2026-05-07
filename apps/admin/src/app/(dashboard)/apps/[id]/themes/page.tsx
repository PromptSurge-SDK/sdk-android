import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';
import { getApp, getThemes, ApiError } from '@/lib/api';
import { ThemesClient } from './ThemesClient';

export const dynamic = 'force-dynamic';

export default async function AppThemesPage({ params }: { params: { id: string } }) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let appName = '';
  let themes: Awaited<ReturnType<typeof getThemes>> = [];

  try {
    const [app, existingThemes] = await Promise.all([
      getApp(token, params.id),
      getThemes(token, params.id),
    ]);
    appName = app.name;
    themes = existingThemes;
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
        <span className="text-gray-900 font-medium">Review Themes</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Review Themes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Paste app store reviews and let AI extract recurring praise themes.
          Accepted themes amplify prompt generation — they&apos;re added to your positive keyword pool automatically.
        </p>
      </div>

      <ThemesClient appId={params.id} initialThemes={themes} />
    </div>
  );
}
