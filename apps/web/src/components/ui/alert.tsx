import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type AlertVariant = 'error' | 'warning' | 'success' | 'info';

const VARIANTS: Record<AlertVariant, { icon: LucideIcon; className: string }> = {
  error: { icon: AlertTriangle, className: 'border-error-500/30 bg-error-500/10 text-error-400' },
  warning: {
    icon: AlertTriangle,
    className: 'border-warning-500/30 bg-warning-500/10 text-warning-400',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-success-500/30 bg-success-500/10 text-success-400',
  },
  info: { icon: Info, className: 'border-blue-light-500/30 bg-blue-light-500/10 text-blue-light-400' },
};

interface AlertProps {
  variant: AlertVariant;
  title: string;
  children?: ReactNode;
}

export const Alert = ({ variant, title, children }: AlertProps) => {
  const { icon: Icon, className } = VARIANTS[variant];

  return (
    <div role="alert" className={`flex gap-3 rounded-xl border p-4 ${className}`}>
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="font-medium text-text">{title}</p>
        {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      </div>
    </div>
  );
};
