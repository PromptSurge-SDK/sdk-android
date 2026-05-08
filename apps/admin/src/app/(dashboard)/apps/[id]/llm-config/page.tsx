import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionToken } from '@/lib/session';
import { getApp, getLlmConfig, getLlmProviders, ApiError } from '@/lib/api';
import { LlmConfigClient } from './LlmConfigClient';

export const dynamic = 'force-dynamic';

export default async function LlmConfigPage({ params }: { params: { id: string } }) {
  const token = getSessionToken();
  if (!token) redirect('/login');

  let appName = '';
  let config: Awaited<ReturnType<typeof getLlmConfig>> = null;
  let providers: Awaited<ReturnType<typeof getLlmProviders>>['providers'] = {};

  try {
    const [app, cfg, prov] = await Promise.all([
      getApp(token, params.id),
      getLlmConfig(token, params.id),
      getLlmProviders(token),
    ]);
    appName = app.name;
    config = cfg;
    providers = prov.providers;
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
        <span className="text-gray-900 font-medium">LLM provider</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bring your own model <span className="text-base font-normal text-gray-400">(optional)</span></h1>
        <p className="mt-1 text-sm text-gray-500">
          PromptSurge includes a built-in AI model — no setup required. If you prefer to use your own
          OpenAI, Anthropic, Gemini, or compatible key, add it here and it will be used instead.
        </p>
      </div>

      <LlmConfigClient appId={params.id} initialConfig={config} providers={providers} />
    </div>
  );
}
