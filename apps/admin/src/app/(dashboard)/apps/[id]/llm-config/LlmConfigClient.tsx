'use client';

import { useState } from 'react';
import type { LlmConfig, ProvidersResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface Props {
  appId: string;
  initialConfig: LlmConfig | null;
  providers: ProvidersResponse['providers'];
}

const PROVIDER_LABELS: Record<string, string> = {
  openai_compatible: 'OpenAI-compatible (DeepSeek, OpenAI, Together, Groq, OpenRouter, self-hosted)',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
};

export function LlmConfigClient({ appId, initialConfig, providers }: Props) {
  const [providerType, setProviderType] = useState<string>(
    initialConfig?.providerType ?? 'openai_compatible',
  );
  const providerModels = providers[providerType]?.models ?? [];
  const defaultModel = providerModels.find(m => m.isDefault)?.id ?? providerModels[0]?.id ?? '';

  const [modelName, setModelName] = useState(initialConfig?.modelName ?? defaultModel);
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState(initialConfig?.apiKeyMasked ?? '');

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  function handleProviderChange(pt: string) {
    setProviderType(pt);
    const models = providers[pt]?.models ?? [];
    const def = models.find(m => m.isDefault) ?? models[0];
    setModelName(def?.id ?? '');
    setBaseUrl(def?.baseUrl ?? '');
    setTestResult(null);
    setSaved(false);
  }

  function handleModelChange(mid: string) {
    setModelName(mid);
    const m = providerModels.find(pm => pm.id === mid);
    if (m && m.baseUrl) setBaseUrl(m.baseUrl);
    setTestResult(null);
    setSaved(false);
  }

  async function handleTest() {
    if (!apiKey && !apiKeyMasked) return;
    setTesting(true);
    setTestResult(null);
    setSaveError('');
    try {
      // Save first so the test hits the current config
      await save();
      const res = await fetch('/api/app-llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, action: 'test' }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : 'Network error' });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!apiKey && !apiKeyMasked) throw new Error('API key required');
    setSaving(true);
    setSaveError('');
    try {
      const body: Record<string, unknown> = { appId, providerType, modelName };
      if (providerType === 'openai_compatible') body.baseUrl = baseUrl;
      if (apiKey) body.apiKey = apiKey;
      else body.apiKey = '_keep_'; // sentinel — we need to handle re-save without re-entering key

      const res = await fetch('/api/app-llm-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setApiKeyMasked(data.config?.apiKeyMasked ?? apiKeyMasked);
      setSaved(true);
      setApiKey(''); // clear plaintext after save
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    try {
      await save();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  const canSave = (!!apiKey || !!apiKeyMasked) && !!modelName;

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
        PromptSurge does not pay for LLM usage. Costs are billed directly by your chosen provider.{' '}
        <strong>DeepSeek</strong> currently offers the cheapest API and provides free starter credits for new accounts.
      </div>

      {/* Provider type */}
      <div>
        <Label className="mb-2 block">LLM provider</Label>
        <div className="space-y-2">
          {Object.entries(PROVIDER_LABELS).map(([pt, label]) => (
            <label key={pt} className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 bg-white p-3 hover:border-brand-300">
              <input
                type="radio"
                name="providerType"
                value={pt}
                checked={providerType === pt}
                onChange={() => handleProviderChange(pt)}
                className="text-brand-600"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Model */}
      <div>
        <Label>Model</Label>
        <Select value={modelName} onChange={e => handleModelChange(e.target.value)}>
          {providerModels.map(m => (
            <option key={m.id} value={m.id}>{m.label ?? m.id}</option>
          ))}
        </Select>
      </div>

      {/* Base URL (openai_compatible only) */}
      {providerType === 'openai_compatible' && (
        <div>
          <Label>API base URL</Label>
          <Input
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
          />
          <p className="mt-1 text-xs text-gray-400">Pre-filled from the selected model. Change only for custom/self-hosted endpoints.</p>
        </div>
      )}

      {/* API key */}
      <div>
        <Label>API key {apiKeyMasked && !apiKey && <span className="font-normal text-gray-400">({apiKeyMasked})</span>}</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={e => { setApiKey(e.target.value); setTestResult(null); setSaved(false); }}
          placeholder={apiKeyMasked ? 'Enter new key to replace…' : 'Paste your provider API key'}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-gray-400">Encrypted at rest — never logged or returned in API responses.</p>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`rounded-md border p-3 text-sm ${testResult.ok ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-700'}`}>
          {testResult.ok ? '✓ Connection successful' : `✗ ${testResult.error ?? 'Connection failed'}`}
        </div>
      )}

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      {saved && !saveError && <p className="text-sm text-green-600">✓ Configuration saved</p>}

      <div className="flex gap-3">
        <Button onClick={handleTest} variant="secondary" disabled={testing || saving || !canSave}>
          {testing ? 'Testing…' : 'Test connection'}
        </Button>
        <Button onClick={handleSave} disabled={saving || !canSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
