'use client';

import { cn } from '@/lib/utils';
import { useColorTheme } from '@/components/providers/color-theme-provider';

type ColorThemeToggleProps = {
  compact?: boolean;
  className?: string;
};

export function ColorThemeToggle({ compact = false, className }: ColorThemeToggleProps) {
  const { theme, toggleTheme } = useColorTheme();
  const isCoastal = theme === 'coastal';
  const swatches = isCoastal
    ? ['#B55F42', '#F5F0E6', '#244C4A']
    : ['#3F1116', '#64343C', '#9D7960'];

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'group inline-flex h-9 items-center gap-2 rounded-xl border border-[rgb(var(--border)/0.8)] bg-[rgb(var(--surface)/0.72)] px-2.5 text-xs font-semibold text-[rgb(var(--text-2))] shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-[rgb(var(--primary)/0.5)] hover:text-[rgb(var(--text))] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)]',
        compact ? 'w-9 justify-center px-0' : 'pr-3',
        className,
      )}
      aria-label={isCoastal ? 'Переключить на клюквенную палитру' : 'Переключить на терракотовую палитру'}
      title={isCoastal ? 'Клюква · сливовый · айвори' : 'Терракота · айвори · тёмный teal'}
    >
      <span className="flex shrink-0 items-center -space-x-1" aria-hidden="true">
        {swatches.map((color, index) => (
          <span
            key={color}
            className={`h-3.5 w-3.5 rounded-full ring-2 ring-[rgb(var(--surface))] ${index === 1 ? 'border border-black/10' : ''}`}
            style={{ backgroundColor: color }}
          />
        ))}
      </span>
      {!compact && <span>Палитра</span>}
    </button>
  );
}
