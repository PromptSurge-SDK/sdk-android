import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface EventRow {
  id: string;
  eventType: string;
  timestamp: string;
  deviceId: string;
  appVersion: string;
  locale: string;
  resolvedLocale: string | null;
  platform: string;
}

interface EventsResponse {
  events: EventRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

const API_URL = process.env.PROMPTSURGE_API_URL ?? 'http://localhost:3000';

async function fetchEvents(page: number): Promise<EventsResponse> {
  const res = await fetch(`${API_URL}/admin/events?page=${page}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load events: HTTP ${res.status}`);
  }
  return res.json();
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page ?? '1') | 0);
  let data: EventsResponse | null = null;
  let error: string | null = null;
  try {
    data = await fetchEvents(page);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Events</h1>
            <p className="text-sm text-gray-500">Last {data?.total ?? 0} SDK events (newest first)</p>
          </div>
          <Link href="/" className="text-sm text-brand-600 hover:underline">
            ← Home
          </Link>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Timestamp</th>
                    <th className="px-4 py-2">Event</th>
                    <th className="px-4 py-2">Device</th>
                    <th className="px-4 py-2">App version</th>
                    <th className="px-4 py-2">Locale</th>
                    <th className="px-4 py-2">Resolved</th>
                    <th className="px-4 py-2">Platform</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.events.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-400" colSpan={7}>
                        No events yet. Tap the button in the sample app to send some.
                      </td>
                    </tr>
                  ) : (
                    data.events.map((e) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                Page {data.page} · showing {data.events.length} of {data.total}
              </span>
              <div className="flex gap-2">
                {data.page > 1 && (
                  <Link
                    href={`/events?page=${data.page - 1}`}
                    className="rounded border border-gray-200 bg-white px-3 py-1 hover:bg-gray-50"
                  >
                    Previous
                  </Link>
                )}
                {data.hasMore && (
                  <Link
                    href={`/events?page=${data.page + 1}`}
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
    </main>
  );
}
