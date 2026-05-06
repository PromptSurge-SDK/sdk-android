import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getEvents, ApiError } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AppEventsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { page?: string };
}) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  const page = Math.max(1, Number(searchParams.page ?? '1') | 0);
  let data: Awaited<ReturnType<typeof getEvents>> | null = null;
  let error: string | null = null;

  try {
    data = await getEvents(token, params.id, page);
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

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          {data && (
            <p className="text-sm text-gray-500">
              {data.total.toLocaleString()} total event{data.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && data.events.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
            </svg>
          </div>
          <h2 className="mb-1 font-semibold text-gray-900">No events yet</h2>
          <p className="max-w-xs text-sm text-gray-500">
            Events appear here once your app sends them using the PromptSurge Android SDK.
          </p>
        </div>
      )}

      {data && data.events.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Timestamp</th>
                  <th className="px-4 py-2">Event</th>
                  <th className="px-4 py-2">Device</th>
                  <th className="px-4 py-2">Version</th>
                  <th className="px-4 py-2">Locale</th>
                  <th className="px-4 py-2">Resolved</th>
                  <th className="px-4 py-2">Platform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.events.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">
                      {new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">{e.eventType}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">
                      {e.deviceId.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-2 text-gray-700">{e.appVersion}</td>
                    <td className="px-4 py-2 text-gray-700">{e.locale}</td>
                    <td className="px-4 py-2 text-gray-700">{e.resolvedLocale ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-700">{e.platform}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {data.page} · {data.events.length} of {data.total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              {data.page > 1 && (
                <Link
                  href={`/apps/${params.id}/events?page=${data.page - 1}`}
                  className="rounded border border-gray-200 bg-white px-3 py-1 hover:bg-gray-50"
                >
                  Previous
                </Link>
              )}
              {data.hasMore && (
                <Link
                  href={`/apps/${params.id}/events?page=${data.page + 1}`}
                  className="rounded border border-gray-200 bg-white px-3 py-1 hover:bg-gray-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
