'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function SidePanel({
  title,
  onClose,
  children,
  className,
  accent,
}: {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  accent?: 'default' | 'success' | 'violet';
}) {
  return (
    <Card
      className={cn(
        accent === 'success' && 'border-emerald-200 dark:border-emerald-800/40',
        accent === 'violet' && 'border-violet-200 dark:border-violet-800/40',
        className,
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[rgb(var(--text-3))] transition-colors hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
              aria-label="Закрыть"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
