import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getEvents, ApiError } from '@/lib/api';
import { getSessionToken } from '@/lib/session';
import { EventsClient } from './EventsClient';

export const dynamic = 'force-dynamic';

export default async function AppEventsPage({
  params,
}: {
  params: { id: string };
}) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let data: Awaited<ReturnType<typeof getEvents>> | null = null;
  let error: string | null = null;

  try {
    data = await getEvents(token, params.id, 1);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    error = e instanceof Error ? e.message : 'Failed to load events';
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-900">Apps</Link>
        <span>/</span>
        <Link href={`/apps/${params.id}`} className="hover:text-gray-900">App</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Events</span>
      </div>

      <EventsClient appId={params.id} initialData={data} initialError={error} />
    </div>
  );
}
