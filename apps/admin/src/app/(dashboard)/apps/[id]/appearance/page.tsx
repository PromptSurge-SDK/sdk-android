import { notFound, redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';
import { getApp, getDialogTheme, ApiError } from '@/lib/api';
import { AppearanceClient } from './AppearanceClient';

export const dynamic = 'force-dynamic';

export default async function AppAppearancePage({ params }: { params: { id: string } }) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  try {
    const [app, theme] = await Promise.all([
      getApp(token, params.id),
      getDialogTheme(token, params.id).catch(() => null),
    ]);
    return <AppearanceClient appId={params.id} appName={app.name} initialTheme={theme} />;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    redirect('/login');
  }
}
