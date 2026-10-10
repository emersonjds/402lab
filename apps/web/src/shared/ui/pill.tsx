import { Check, CircleDot, Clock, Pause, X, type LucideIcon } from 'lucide-react';

export type PillStatus = 'active' | 'paused' | 'settled' | 'pending' | 'failed';

const PILL_STYLES: Record<PillStatus, { icon: LucideIcon; className: string }> = {
  active: { icon: CircleDot, className: 'border-lime/40 bg-lime/10 text-lime' },
  paused: { icon: Pause, className: 'border-amber/40 bg-amber/10 text-amber' },
  settled: { icon: Check, className: 'border-lime/40 bg-lime/10 text-lime' },
  pending: { icon: Clock, className: 'border-line bg-raised text-muted' },
  failed: { icon: X, className: 'border-red/40 bg-red/10 text-red' },
};

export const Pill = ({ status }: { status: PillStatus }) => {
  const { icon: Icon, className } = PILL_STYLES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wider ${className}`}
    >
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      {status.toUpperCase()}
    </span>
  );
};
