import { notFound, redirect } from 'next/navigation';
import { getApp, getApps, getSubscription } from '@/lib/api';
import { getSessionToken } from '@/lib/session';
import { AppSidebar } from '@/components/AppSidebar';

export const dynamic = 'force-dynamic';

interface Props {
  children: React.ReactNode;
  params: { id: string };
}

export default async function AppLayout({ children, params }: Props) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let appName = '';
  try {
    const app = await getApp(token, params.id);
    appName = app.name;
  } catch (e: unknown) {
    const status = (e as { status?: number }).status;
    if (status === 404) notFound();
    redirect('/login');
  }

  const [appsResult, subResult] = await Promise.allSettled([
    getApps(token),
    getSubscription(token, params.id),
  ]);

  const apps = appsResult.status === 'fulfilled'
    ? appsResult.value.map(a => ({ id: a.id, name: a.name }))
    : [];
  const subscription = subResult.status === 'fulfilled' ? subResult.value : null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <AppSidebar appId={params.id} appName={appName} apps={apps} subscription={subscription} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
