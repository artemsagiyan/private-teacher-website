import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium leading-none transition-colors',
  {
    variants: {
      variant: {
        default:   'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
        success:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400',
        warning:   'bg-amber-100 text-amber-700 dark:bg-amber-900/25 dark:text-amber-400',
        danger:    'bg-red-100 text-red-600 dark:bg-red-900/25 dark:text-red-400',
        secondary: 'bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))] border border-[rgb(var(--border))]',
        outline:   'border border-[rgb(var(--border))] text-[rgb(var(--text-2))]',
        violet:    'bg-violet-100 text-violet-700 dark:bg-violet-900/25 dark:text-violet-400',
      },
      dot: {
        true:  '',
        false: '',
      },
    },
    defaultVariants: { variant: 'default', dot: false },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const dotColors: Record<string, string> = {
  default:   'bg-primary-500',
  success:   'bg-emerald-500',
  warning:   'bg-amber-500',
  danger:    'bg-red-500',
  secondary: 'bg-gray-400',
  outline:   'bg-gray-400',
  violet:    'bg-violet-500',
};

function Badge({ className, variant = 'default', dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, dot }), className)} {...props}>
      {dot && (
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', dotColors[variant ?? 'default'])} />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
