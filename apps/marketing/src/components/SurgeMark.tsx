/**
 * SurgeMark — the PromptSurge logo icon, inlined for the marketing site.
 * Static-friendly: no 'use client' needed since animations are CSS-only.
 */

interface Props {
  size?: 'nav' | 'hero';
  className?: string;
}

const SIZE_MAP = {
  nav:  { shell: 36, svgW: 30, svgH: 26 },
  hero: { shell: 72, svgW: 56, svgH: 50 },
} as const;

export function SurgeMark({ size = 'nav', className = '' }: Props) {
  const { shell, svgW, svgH } = SIZE_MAP[size];

  return (
    <div
      className={`flex shrink-0 items-center justify-center ${className}`}
      style={{
        width: shell,
        height: shell,
        borderRadius: '22.4%',
        background: 'linear-gradient(145deg, #1FB896, #0B8068)',
        boxShadow: '0 4px 24px rgba(14,158,128,0.30), 0 1px 4px rgba(14,158,128,0.14)',
      }}
    >
      <svg width={svgW} height={svgH} viewBox="0 0 64 56" fill="none" aria-hidden>
        {/* Zone 1 — subdued undulation */}
        <path
          d="M4 36 L9 36 L13 28 L17 38 L21 36 L26 36"
          stroke="white" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round"
          fill="none" opacity="0.4"
        />
        {/* Zone 2 — steep ascent to peak */}
        <path
          d="M26 36 L32 13"
          stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"
          fill="none"
        />
        {/* Bezier descent */}
        <path
          d="M32 13 C33 18, 35 24, 38 30"
          stroke="white" strokeWidth="3.0" strokeLinecap="round" fill="none" opacity="0.92"
        />
        {/* Zone 3 — heartbeat echo */}
        <path
          d="M38 30 L43 30 L46 23 L49 35 L52 30 L60 30"
          stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          fill="none" opacity="0.7"
        />
        {/* Peak dot */}
        <circle cx="32" cy="13" r="3.8" fill="white" />
        {/* Burst rays */}
        <line x1="32" y1="7.5" x2="32" y2="5"   stroke="white" strokeWidth="1.7" strokeLinecap="round" />
        <line x1="38" y1="9.5" x2="40" y2="7.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
        <line x1="26" y1="9.5" x2="24" y2="7.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
        <line x1="42" y1="13"  x2="44" y2="13"  stroke="white" strokeWidth="1.7" strokeLinecap="round" />
        <line x1="22" y1="13"  x2="20" y2="13"  stroke="white" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Full brand lockup: SurgeMark + split-colour wordmark. */
export function BrandLockup({ size = 'nav' }: { size?: 'nav' | 'hero' }) {
  const wordSize = size === 'nav' ? 'text-[20px]' : 'text-[34px]';

  return (
    <div className="flex items-center gap-2">
      <SurgeMark size={size} />
      <span
        className={`${wordSize} font-semibold leading-none tracking-tight`}
        style={{ color: '#1A1F2E', letterSpacing: '-0.025em' }}
      >
        Prompt<span style={{ color: '#0E9E80' }}>Surge</span>
      </span>
    </div>
  );
}
