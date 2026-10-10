import type { LabelHTMLAttributes } from 'react';

export const Label = ({ className = '', ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label {...props} className={`mb-1.5 block text-sm font-medium text-muted ${className}`} />
);
