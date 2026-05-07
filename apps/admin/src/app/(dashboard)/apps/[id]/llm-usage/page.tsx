import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';
import { getApp, getLlmUsage, ApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function LlmUsagePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { page?: string };
}) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  const page = Math.max(1, Number(searchParams.page ?? '1') | 0);
  let appName = '';
  let data: Awaited<ReturnType<typeof getLlmUsage>> | null = null;

  try {
    const [app, usage] = await Promise.all([
      getApp(token, params.id),
      getLlmUsage(token, params.id, page),
    ]);
    appName = app.name;
    data = usage;
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
        <span className="text-gray-900 font-medium">LLM usage</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">LLM usage</h1>
        <p className="mt-1 text-sm text-gray-500">
          A record of every LLM API call made on your behalf. Token counts are for visibility only — costs are billed directly by your provider.
        </p>
      </div>

      {data && data.logs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="font-semibold text-gray-900">No LLM calls yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Calls appear here after you generate prompt suggestions or test a connection.
          </p>
        </div>
      )}

      {data && data.logs.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Timestamp</th>
                  <th className="px-4 py-2">Provider / Model</th>
                  <th className="px-4 py-2">Purpose</th>
                  <th className="px-4 py-2 text-right">Input tokens</th>
                  <th className="px-4 py-2 text-right">Output tokens</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.logs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">
                      {new Date(l.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">{l.modelName}</div>
                      <div className="text-xs text-gray-400">{l.providerType}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-600 capitalize">{l.purpose.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-gray-700">
                      {l.inputTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-gray-700">
                      {l.outputTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      {l.success ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">OK</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700" title={l.errorMessage ?? ''}>
                          Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>Page {data.page} · {data.logs.length} of {data.total.toLocaleString()}</span>
            <div className="flex gap-2">
              {data.page > 1 && (
                <Link href={`/apps/${params.id}/llm-usage?page=${data.page - 1}`}
                  className="rounded border border-gray-200 bg-white px-3 py-1 hover:bg-gray-50">
                  Previous
                </Link>
              )}
              {data.hasMore && (
                <Link href={`/apps/${params.id}/llm-usage?page=${data.page + 1}`}
                  className="rounded border border-gray-200 bg-white px-3 py-1 hover:bg-gray-50">
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
