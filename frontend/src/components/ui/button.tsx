'use client';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium',
    'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
    'disabled:pointer-events-none disabled:opacity-40 select-none',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'bg-primary-600 text-white shadow-sm',
          'hover:bg-primary-700 active:bg-primary-800',
          'dark:bg-primary-500 dark:hover:bg-primary-600',
        ].join(' '),
        outline: [
          'border border-[rgb(var(--border))] bg-transparent text-[rgb(var(--text-2))]',
          'hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))] hover:border-[rgb(var(--border))]',
          'active:bg-[rgb(var(--border))]',
        ].join(' '),
        ghost: [
          'text-[rgb(var(--text-2))]',
          'hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]',
          'active:bg-[rgb(var(--border))]',
        ].join(' '),
        destructive: 'bg-red-500 text-white shadow-sm hover:bg-red-600 active:bg-red-700',
        secondary: [
          'bg-[rgb(var(--surface-2))] text-[rgb(var(--text))] border border-[rgb(var(--border))]',
          'hover:bg-[rgb(var(--border)/0.5)] active:bg-[rgb(var(--border))]',
        ].join(' '),
        link: 'text-primary-600 underline-offset-4 hover:underline dark:text-primary-400 p-0 h-auto',
        gradient: [
          'bg-gradient-to-r from-primary-600 to-violet-500 text-white shadow-sm',
          'hover:from-primary-700 hover:to-violet-600 active:from-primary-800',
          'shadow-glow',
        ].join(' '),
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:  'h-7 rounded-md px-3 text-xs',
        lg:  'h-11 rounded-xl px-6 text-base',
        xl:  'h-12 rounded-xl px-8 text-base font-semibold',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
