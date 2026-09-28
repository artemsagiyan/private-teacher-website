import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f3f7f6',
          100: '#e3eeeb',
          200: '#c5dbd6',
          300: '#96bfb7',
          400: '#5d9c93',
          500: '#2f7d73',
          600: '#14635c',
          700: '#114e49',
          800: '#123f3b',
          900: '#123330',
        },
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        surface: {
          DEFAULT: '#ffffff',
          2: '#f8f8fc',
          dark: '#0e0e1c',
          dark2: '#13131f',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'slide-in-left': { from: { opacity: '0', transform: 'translateX(-100%)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        dash: { from: { strokeDashoffset: '220' }, to: { strokeDashoffset: '0' } },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
        'slide-in-left': 'slide-in-left 0.22s ease-out',
        'scale-in': 'scale-in 0.15s ease-out',
        shimmer: 'shimmer 2s infinite linear',
        dash: 'dash 1s ease forwards',
      },
      boxShadow: {
        'glow': '0 10px 30px rgb(20 99 92 / 0.16)',
        'glow-lg': '0 18px 50px rgb(20 99 92 / 0.18)',
        'card': '0 1px 2px rgb(28 27 25 / 0.04), 0 12px 32px rgb(28 27 25 / 0.05)',
        'card-hover': '0 8px 24px rgb(28 27 25 / 0.08)',
        'sidebar': '1px 0 0 0 rgb(255 255 255 / 0.05)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(rgb(0 0 0 / 0.03) 1px, transparent 1px), linear-gradient(90deg, rgb(0 0 0 / 0.03) 1px, transparent 1px)',
        'grid-pattern-dark': 'linear-gradient(rgb(255 255 255 / 0.03) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.03) 1px, transparent 1px)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
