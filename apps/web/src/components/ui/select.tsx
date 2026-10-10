import type { SelectHTMLAttributes } from 'react';

export const Select = ({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`h-11 w-full rounded-lg border border-line bg-raised px-4 text-base text-text focus:border-brand-400 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden ${className}`}
  >
    {children}
  </select>
);
