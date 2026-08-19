'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      className={cn(
        'inline-flex gap-1 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-1',
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200',
              size === 'sm' ? 'px-2.5 py-1.5 text-[0.7rem]' : 'px-3 py-1.5 text-xs',
              active
                ? 'bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-card'
                : 'text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]',
              opt.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
