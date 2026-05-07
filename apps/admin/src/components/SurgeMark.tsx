/**
 * SurgeMark — the PromptSurge logo icon.
 *
 * Sizes:
 *   'nav'  — 44×44 shell, 36×32 SVG  (dashboard header)
 *   'auth' — 52×52 shell, 42×37 SVG  (login / signup cards)
 *   'hero' — 80×80 shell, 64×56 SVG  (landing / hero sections)
 */

interface Props {
  size?: 'nav' | 'auth' | 'hero';
  animated?: boolean;
  className?: string;
}

const SIZE_MAP = {
  nav:  { shell: 44, svgW: 36, svgH: 32, radius: '22.4%' },
  auth: { shell: 52, svgW: 42, svgH: 37, radius: '22.4%' },
  hero: { shell: 80, svgW: 64, svgH: 56, radius: '22.4%' },
} as const;

export function SurgeMark({ size = 'nav', animated = true, className = '' }: Props) {
  const { shell, svgW, svgH, radius } = SIZE_MAP[size];

  return (
    <div
      className={`flex shrink-0 items-center justify-center ${className}`}
      style={{
        width: shell,
        height: shell,
        borderRadius: radius,
        background: 'linear-gradient(145deg, #1FB896, #0B8068)',
        boxShadow: '0 4px 28px rgba(14,158,128,0.30), 0 1px 4px rgba(14,158,128,0.14)',
      }}
    >
      <svg
        width={svgW}
        height={svgH}
        viewBox="0 0 64 56"
        fill="none"
        aria-hidden
      >
        {/* Zone 1 — Pre-ascent: subdued undulation */}
        <path
          d="M4 36 L9 36 L13 28 L17 38 L21 36 L26 36"
          stroke="white"
          strokeWidth="2.0"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.4"
        />

        {/* Zone 2 — Highlight: steep ascent to peak */}
        <path
          d="M26 36 L32 13"
          stroke="white"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Gentle bezier descent to higher plateau */}
        <path
          d="M32 13 C33 18, 35 24, 38 30"
          stroke="white"
          strokeWidth="3.0"
          strokeLinecap="round"
          fill="none"
          opacity="0.92"
        />

        {/* Zone 3 — Heartbeat echo at plateau */}
        <path
          d="M38 30 L43 30 L46 23 L49 35 L52 30 L60 30"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.7"
        />

        {/* Peak dot */}
        <circle
          cx="32"
          cy="13"
          r="3.8"
          fill="white"
          className={animated ? 'animate-surge-pulse' : undefined}
        />

        {/* Burst rays */}
        <line x1="32" y1="7.5" x2="32" y2="5"   stroke="white" strokeWidth="1.7" strokeLinecap="round" className={animated ? 'animate-ray-flash-1' : undefined} />
        <line x1="38" y1="9.5" x2="40" y2="7.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" className={animated ? 'animate-ray-flash-2' : undefined} />
        <line x1="26" y1="9.5" x2="24" y2="7.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" className={animated ? 'animate-ray-flash-3' : undefined} />
        <line x1="42" y1="13"  x2="44" y2="13"  stroke="white" strokeWidth="1.7" strokeLinecap="round" className={animated ? 'animate-ray-flash-4' : undefined} />
        <line x1="22" y1="13"  x2="20" y2="13"  stroke="white" strokeWidth="1.7" strokeLinecap="round" className={animated ? 'animate-ray-flash-5' : undefined} />
      </svg>
    </div>
  );
}

/**
 * Full brand lockup: icon + wordmark (+ optional tagline).
 * Use in nav header.
 */
interface LockupProps {
  size?: 'nav' | 'hero';
  showTagline?: boolean;
  className?: string;
}

export function BrandLockup({ size = 'nav', showTagline = false, className = '' }: LockupProps) {
  const wordmarkSize = size === 'nav' ? 'text-[22px]' : 'text-[38px]';
  const taglineSize  = size === 'nav' ? 'text-[11px]' : 'text-[13px]';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <SurgeMark size={size === 'nav' ? 'nav' : 'hero'} />
      <div>
        <div
          className={`${wordmarkSize} font-semibold leading-none tracking-tight`}
          style={{ color: '#1A1F2E', letterSpacing: '-0.025em' }}
        >
          Prompt<span style={{ color: '#0E9E80' }}>Surge</span>
        </div>
        {showTagline && (
          <div
            className={`${taglineSize} mt-0.5`}
            style={{ color: 'rgba(26,31,46,0.5)', letterSpacing: '0' }}
          >
            Review Intelligence SDK
          </div>
        )}
      </div>
    </div>
  );
}
