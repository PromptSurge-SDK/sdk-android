import { notFound, redirect } from 'next/navigation';
import { getApp } from '@/lib/api';
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
    console.error('[AppLayout] getApp failed:', { appId: params.id, status, error: String(e) });
    if (status === 404) notFound();
    redirect('/login');
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <AppSidebar appId={params.id} appName={appName} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
