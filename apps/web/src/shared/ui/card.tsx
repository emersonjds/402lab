import type { HTMLAttributes } from 'react';

export const Card = ({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={`rounded-card border border-line bg-surface ${className}`} />
);
