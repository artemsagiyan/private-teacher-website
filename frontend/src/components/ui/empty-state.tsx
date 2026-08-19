import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-4 py-10',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--surface-2))] text-[rgb(var(--text-3))]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-[rgb(var(--text))]">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-xs leading-5 text-[rgb(var(--text-3))]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
