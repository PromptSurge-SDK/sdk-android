'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { EventsResponse } from '@/lib/api';

interface Props {
  appId: string;
  initialData: EventsResponse | null;
  initialError: string | null;
}

const REFRESH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function EventsClient({ appId, initialData, initialError }: Props) {
  const [data, setData] = useState<EventsResponse | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [page, setPage] = useState(initialData?.page ?? 1);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/app-events?appId=${appId}&page=${p}`);
      if (!res.ok) throw new Error('Failed to load events');
      const d: EventsResponse = await res.json();
      setData(d);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  // Auto-refresh on interval (only when tab is visible)
  useEffect(() => {
    const start = () => {
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') fetchPage(page);
      }, REFRESH_INTERVAL_MS);
    };
    const stop = () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
    const handleVisibility = () => document.visibilityState === 'visible' ? start() : stop();

    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [fetchPage, page]);

  function goToPage(p: number) {
    setPage(p);
    fetchPage(p);
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">Events</h1>
            {loading && <span className="animate-pulse text-xs text-gray-400">Refreshing…</span>}
          </div>
          {data && (
            <p className="text-sm text-gray-500">
              {data.total.toLocaleString()} total event{data.total !== 1 ? 's' : ''}
            </p>
          )}
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Auto-refreshes every 2 min · Last updated {lastRefreshed.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => fetchPage(page)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
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
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{e.deviceId.slice(0, 12)}…</td>
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
            <span>Page {data.page} · {data.events.length} of {data.total.toLocaleString()}</span>
            <div className="flex gap-2">
              {data.page > 1 && (
                <button
                  onClick={() => goToPage(data.page - 1)}
                  className="rounded border border-gray-200 bg-white px-3 py-1 hover:bg-gray-50"
                >
                  Previous
                </button>
              )}
              {data.hasMore && (
                <button
                  onClick={() => goToPage(data.page + 1)}
                  className="rounded border border-gray-200 bg-white px-3 py-1 hover:bg-gray-50"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
