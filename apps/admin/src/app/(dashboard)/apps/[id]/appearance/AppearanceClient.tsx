'use client';

import { useState, useEffect } from 'react';
import type { AppDialogTheme } from '@/lib/api';
import { Button } from '@/components/ui/button';

// ─── Preset definitions (mirrored from API) ───────────────────────────────────

const PRESETS = [
  {
    id: 'system',
    name: 'System',
    description: 'Android Material Design',
    backgroundColor: '#FFFBFE',
    accentColor: '#6750A4',
    textColor: '#1C1B1F',
    buttonTextColor: '#FFFFFF',
  },
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'Like a ray, man',
    backgroundColor: '#1A2744',
    accentColor: '#FFD23F',
    textColor: '#FFFFFF',
    buttonTextColor: '#1A2744',
  },
  {
    id: 'sweet',
    name: 'Sweet',
    description: 'Sweet as Crushed Candy',
    backgroundColor: '#5B2080',
    accentColor: '#F7A722',
    textColor: '#FAF0D3',
    buttonTextColor: '#5B2080',
  },
  {
    id: 'metal',
    name: 'Metal',
    description: 'Mecha Metal Revolution',
    backgroundColor: '#13111A',
    accentColor: '#A8A8B8',
    textColor: '#F0F0F5',
    buttonTextColor: '#13111A',
  },
] as const;

type PresetId = (typeof PRESETS)[number]['id'];

// Map legacy stored presetIds to current ones
const LEGACY_ID_MAP: Record<string, PresetId> = {
  default: 'system',
  midnight: 'gaming',
  ocean: 'sweet',
  sunset: 'metal',
};

// ─── Mini dialog preview ──────────────────────────────────────────────────────

function DialogPreview({
  backgroundColor, accentColor, textColor, buttonTextColor,
}: {
  backgroundColor: string; accentColor: string; textColor: string; buttonTextColor: string;
}) {
  return (
    <div
      className="mx-auto w-40 rounded-xl p-3 shadow-md"
      style={{ backgroundColor }}
    >
      <p className="text-[10px] font-semibold mb-1" style={{ color: textColor }}>
        Enjoying this app?
      </p>
      <p className="text-[8px] leading-tight mb-3" style={{ color: textColor, opacity: 0.75 }}>
        Reviews help others discover apps like this. Got a moment?
      </p>
      <div className="flex gap-1.5 justify-end">
        <span
          className="rounded px-1.5 py-0.5 text-[8px] font-medium"
          style={{ color: accentColor }}
        >
          Not now
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[8px] font-semibold"
          style={{ backgroundColor: accentColor, color: buttonTextColor }}
        >
          Sure
        </span>
      </div>
    </div>
  );
}

// ─── Hex color input ──────────────────────────────────────────────────────────

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // Local text lets user type freely (with or without #); parent only receives valid #RRGGBB
  const [localText, setLocalText] = useState(value || '');

  useEffect(() => {
    setLocalText(value || '');
  }, [value]);

  function handleTextChange(raw: string) {
    setLocalText(raw);
    const stripped = raw.replace(/^#+/, '').trim();
    if (/^[0-9A-Fa-f]{6}$/i.test(stripped)) {
      onChange('#' + stripped.toUpperCase());
    } else if (raw === '') {
      onChange('');
    }
  }

  const isValid = HEX_RE.test(value);
  const pickerValue = isValid ? value : '#000000';
  const showError = localText !== '' && !HEX_RE.test(value);

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={e => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border border-gray-200"
        />
        <input
          type="text"
          value={localText}
          onChange={e => handleTextChange(e.target.value)}
          placeholder="RRGGBB or #RRGGBB"
          maxLength={7}
          className={`w-32 rounded border px-2 py-1 text-xs font-mono ${showError ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
        />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  appId: string;
  appName: string;
  initialTheme: AppDialogTheme | null;
}

export function AppearanceClient({ appId, appName, initialTheme }: Props) {
  const initial = initialTheme ?? {
    presetId: 'default',
    accentColor: null,
    backgroundColor: null,
    textColor: null,
    buttonTextColor: null,
    resolved: PRESETS[0],
  };

  const rawPresetId = initial.presetId as string;
  const resolvedInitialPreset: PresetId = (PRESETS.find(p => p.id === rawPresetId)?.id as PresetId)
    ?? LEGACY_ID_MAP[rawPresetId]
    ?? 'system';
  const [presetId, setPresetId] = useState<PresetId>(resolvedInitialPreset);
  const [accentColor, setAccentColor] = useState(initial.accentColor ?? '');
  const [backgroundColor, setBackgroundColor] = useState(initial.backgroundColor ?? '');
  const [textColor, setTextColor] = useState(initial.textColor ?? '');
  const [buttonTextColor, setButtonTextColor] = useState(initial.buttonTextColor ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const preset = PRESETS.find(p => p.id === presetId) ?? PRESETS[0];

  // Resolved preview colors: overrides take precedence over preset
  const hex = (override: string, fallback: string) =>
    /^#[0-9A-Fa-f]{6}$/.test(override) ? override : fallback;

  const previewColors = {
    backgroundColor: hex(backgroundColor, preset.backgroundColor),
    accentColor: hex(accentColor, preset.accentColor),
    textColor: hex(textColor, preset.textColor),
    buttonTextColor: hex(buttonTextColor, preset.buttonTextColor),
  };

  function selectPreset(id: PresetId) {
    setPresetId(id);
    // Clear overrides when switching presets
    setAccentColor('');
    setBackgroundColor('');
    setTextColor('');
    setButtonTextColor('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(`/api/app-appearance?appId=${appId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetId,
          accentColor: accentColor || null,
          backgroundColor: backgroundColor || null,
          textColor: textColor || null,
          buttonTextColor: buttonTextColor || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to save');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const hasOverrides = accentColor || backgroundColor || textColor || buttonTextColor;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Appearance</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Customise the pre-prompt dialog shown to users — {appName}
        </p>
      </div>

      {/* Preset selector */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <p className="mb-1 text-sm font-semibold text-gray-900">Dialog theme</p>
        <p className="mb-4 text-xs text-gray-500">
          Choose a preset. The dialog&apos;s appearance is cached on device for 24 hours after first load.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRESETS.map(p => {
            const active = presetId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => selectPreset(p.id as PresetId)}
                className={`group flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                  active
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <DialogPreview
                  backgroundColor={p.backgroundColor}
                  accentColor={p.accentColor}
                  textColor={p.textColor}
                  buttonTextColor={p.buttonTextColor}
                />
                <span className={`text-xs font-semibold ${active ? 'text-brand-700' : 'text-gray-600'}`}>
                  {p.name}
                </span>
                <span className="text-[10px] text-gray-400 leading-tight text-center">{p.description}</span>
                {active && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600">
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom color overrides */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <p className="mb-1 text-sm font-semibold text-gray-900">Design your own palette</p>
        <p className="mb-4 text-xs text-gray-500">
          Override individual colors from the selected preset. Leave blank to use preset defaults.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ColorField label="Accent color" value={accentColor} onChange={setAccentColor} />
          <ColorField label="Background color" value={backgroundColor} onChange={setBackgroundColor} />
          <ColorField label="Text color" value={textColor} onChange={setTextColor} />
          <ColorField label="Button text color" value={buttonTextColor} onChange={setButtonTextColor} />
        </div>
        {hasOverrides && (
          <button
            onClick={() => { setAccentColor(''); setBackgroundColor(''); setTextColor(''); setButtonTextColor(''); }}
            className="mt-3 text-xs text-gray-400 hover:text-gray-700"
          >
            Clear overrides
          </button>
        )}
      </div>

      {/* Live preview */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <p className="mb-1 text-sm font-semibold text-gray-900">Live preview</p>
        <p className="mb-4 text-xs text-gray-500">Approximate rendering — actual dialog uses native Android Material components.</p>
        <div className="flex items-center justify-center rounded-lg bg-gray-100 py-10">
          <DialogPreview {...previewColors} />
        </div>
      </div>

      {/* Header image — scaffold */}
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Header image</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Optional image displayed above the dialog title. Shown only when a URL is set on the prompt text.
            </p>
          </div>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Coming soon</span>
        </div>
        <div className="mt-4 flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8">
          <p className="text-xs text-gray-400">Drag & drop or paste an image URL — upload support coming in a future release</p>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {saved && <p className="text-sm text-green-600">Saved — changes will propagate to devices within 24 hours.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
