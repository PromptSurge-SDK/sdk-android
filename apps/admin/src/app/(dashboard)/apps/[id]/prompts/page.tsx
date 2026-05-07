import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';
import { getApp, getPrompts, getLlmConfig, ApiError } from '@/lib/api';
import { PromptsClient } from './PromptsClient';

export const dynamic = 'force-dynamic';

export default async function AppPromptsPage({ params }: { params: { id: string } }) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let appName = '';
  let prompts: Awaited<ReturnType<typeof getPrompts>> = [];
  let hasLlmConfig = false;

  try {
    const [app, pts, cfg] = await Promise.all([
      getApp(token, params.id),
      getPrompts(token, params.id),
      getLlmConfig(token, params.id),
    ]);
    appName = app.name;
    prompts = pts;
    hasLlmConfig = cfg !== null;
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
        <span className="text-gray-900 font-medium">Prompt texts</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Prompt texts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage the copy shown in the pre-prompt dialog. The SDK picks one active text per locale at runtime.
        </p>
      </div>

      <PromptsClient appId={params.id} prompts={prompts} hasLlmConfig={hasLlmConfig} />
    </div>
  );
}
