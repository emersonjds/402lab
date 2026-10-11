import type { ReactNode } from 'react';

export type BadgeColor = 'brand' | 'success' | 'error' | 'warning' | 'info' | 'neutral';

const COLORS: Record<BadgeColor, string> = {
  brand: 'bg-brand-500/10 text-brand-400 border-brand-500/25',
  success: 'bg-success-500/10 text-success-400 border-success-500/25',
  error: 'bg-error-500/10 text-error-400 border-error-500/25',
  warning: 'bg-warning-500/10 text-warning-400 border-warning-500/25',
  info: 'bg-blue-light-500/10 text-blue-light-400 border-blue-light-500/25',
  neutral: 'bg-raised text-muted border-line',
};

interface BadgeProps {
  color?: BadgeColor;
  children: ReactNode;
}

export const Badge = ({ color = 'neutral', children }: BadgeProps) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-0.5 font-mono text-xs font-semibold tracking-wide ${COLORS[color]}`}
  >
    {children}
  </span>
);
