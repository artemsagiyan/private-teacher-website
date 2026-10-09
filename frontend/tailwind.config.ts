import type { Config } from 'tailwindcss';

const ivory = '#FFF1E9';
const beige = '#FEEFDC';
const taupe = '#9D7960';
const plum = '#64343C';
const cranberry = '#3F1116';

const palette = {
  50: ivory,
  100: ivory,
  200: beige,
  300: taupe,
  400: taupe,
  500: cranberry,
  600: cranberry,
  700: cranberry,
  800: plum,
  900: plum,
  950: cranberry,
};

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
        white: ivory,
        black: cranberry,
        primary: {
          50: ivory,
          100: ivory,
          200: beige,
          300: taupe,
          400: taupe,
          500: cranberry,
          600: cranberry,
          700: cranberry,
          800: plum,
          900: plum,
        },
        violet: palette,
        indigo: palette,
        red: palette,
        rose: palette,
        emerald: palette,
        green: palette,
        amber: palette,
        yellow: palette,
        orange: palette,
        sky: palette,
        cyan: palette,
        blue: palette,
        zinc: palette,
        slate: palette,
        gray: palette,
        neutral: palette,
        purple: palette,
        fuchsia: palette,
        pink: palette,
        teal: palette,
        lime: palette,
        surface: {
          DEFAULT: ivory,
          2: taupe,
          dark: plum,
          dark2: cranberry,
        },
      },
      borderRadius: {
        xl: '8px',
        '2xl': '8px',
        '3xl': '8px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Palatino', 'serif'],
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
        'glow': '0 1px 3px rgb(63 17 22 / 0.22), 0 1px 2px rgb(100 52 60 / 0.28)',
        'glow-lg': '0 4px 8px 3px rgb(63 17 22 / 0.22), 0 1px 3px rgb(100 52 60 / 0.28)',
        'card': '0 1px 2px rgb(100 52 60 / 0.12), 0 2px 6px 2px rgb(63 17 22 / 0.1)',
        'card-hover': '0 2px 6px 2px rgb(63 17 22 / 0.2)',
        'sidebar': '1px 0 0 0 #9D7960',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(rgb(157 121 96 / 0.45) 1px, transparent 1px), linear-gradient(90deg, rgb(157 121 96 / 0.45) 1px, transparent 1px)',
        'grid-pattern-dark': 'linear-gradient(rgb(255 241 233 / 0.16) 1px, transparent 1px), linear-gradient(90deg, rgb(255 241 233 / 0.16) 1px, transparent 1px)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
