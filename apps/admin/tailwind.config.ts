import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand teal ramp — exact spec values
        brand: {
          50:  '#E0F5EF',
          100: '#A8E3D0',
          200: '#5CCBB0',
          300: '#1FB896',
          400: '#0E9E80', // primary
          500: '#0B8068', // hover
          600: '#086050',
          700: '#053F35',
        },
        // Neutral ramp
        neutral: {
          50:  '#FAFAF9',
          100: '#F2F0EA',
          200: '#D5D3CA',
          400: '#888780',
          700: '#3D3C38',
        },
        // Ink (primary text)
        ink: {
          DEFAULT: '#1A1F2E',
          60: 'rgba(26,31,46,0.6)',
          30: 'rgba(26,31,46,0.3)',
          10: 'rgba(26,31,46,0.08)',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-space-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tight:  '-0.025em',
        tighter: '-0.03em',
      },
    },
  },
  plugins: [],
};

export default config;
