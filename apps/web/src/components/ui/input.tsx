import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  hint?: string | undefined;
}

/** Text size stays >= 16px (DESIGN.md) so mobile browsers never zoom on focus. */
export const Input = ({ error = false, hint, className = '', ...props }: InputProps) => (
  <div>
    <input
      {...props}
      className={`h-11 w-full rounded-lg border bg-raised px-4 text-base text-text placeholder:text-muted focus:outline-hidden focus:ring-3 ${
        error
          ? 'border-error-500 focus:border-error-400 focus:ring-error-500/20'
          : 'border-line focus:border-brand-400 focus:ring-brand-500/20'
      } ${className}`}
    />
    {hint && <p className={`mt-1.5 text-xs ${error ? 'text-error-400' : 'text-muted'}`}>{hint}</p>}
  </div>
);
