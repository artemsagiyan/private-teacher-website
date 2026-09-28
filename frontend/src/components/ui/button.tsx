'use client';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium tracking-normal',
    'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-40 select-none',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'bg-primary-600 text-white',
          'hover:bg-primary-700 active:bg-primary-800',
        ].join(' '),
        outline: [
          'border border-primary-600 bg-transparent text-primary-600',
          'hover:bg-primary-50',
          'active:bg-primary-100',
        ].join(' '),
        ghost: [
          'text-primary-600',
          'hover:bg-primary-50',
          'active:bg-primary-100',
        ].join(' '),
        destructive: 'bg-[#B3261E] text-white hover:bg-[#8C1D18] active:bg-[#601410]',
        secondary: [
          'bg-primary-100 text-primary-900',
          'hover:bg-primary-200 active:bg-primary-300',
        ].join(' '),
        link: 'text-primary-600 underline-offset-4 hover:underline p-0 h-auto',
        gradient: [
          'bg-primary-600 text-white',
          'hover:bg-primary-700 active:bg-primary-800',
        ].join(' '),
      },
      size: {
        default: 'h-10 px-6',
        sm:  'h-8 px-4 text-xs',
        lg:  'h-12 px-6 text-base',
        xl:  'h-14 px-8 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
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
