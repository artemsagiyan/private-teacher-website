import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[rgb(var(--text-2))] tracking-wide uppercase"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          className={cn(
            'flex h-9 w-full rounded-lg px-3 py-2 text-sm text-[rgb(var(--text))]',
            'bg-[rgb(var(--surface))] border border-[rgb(var(--border))]',
            'placeholder:text-[rgb(var(--text-3))]',
            'transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500',
            'disabled:cursor-not-allowed disabled:opacity-40',
            error && 'border-red-400 focus:ring-red-400/40 focus:border-red-400',
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-red-500 flex items-center gap-1">{error}</p>}
        {hint && !error && <p className="text-xs text-[rgb(var(--text-3))]">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
