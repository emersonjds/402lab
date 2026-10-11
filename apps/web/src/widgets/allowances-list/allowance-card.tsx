'use client';

import { formatUsd, parseAtomic } from '@402lab/shared';
import Link from 'next/link';
import { useState } from 'react';

import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Button, buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError, apiRequest } from '@/shared/api/client';
import { allowanceSchema, type Allowance } from '@/shared/api/schemas';
import { shortAddress } from '@/shared/format/address';
import { useSessionUsdcBalance } from '@/shared/wallet/session-balance';

const STATUS_BADGE: Record<Allowance['status'], BadgeColor> = { active: 'success', paused: 'warning' };

interface AllowanceCardProps {
  allowance: Allowance;
}

export const AllowanceCard = ({ allowance: initial }: AllowanceCardProps) => {
  const [allowance, setAllowance] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionBalance = useSessionUsdcBalance(allowance.sessionAddress);

  const spentToday = parseAtomic(allowance.spentToday);
  const dailyCap = parseAtomic(allowance.dailyCap);
  const progress = dailyCap > 0n ? Number((spentToday * 100n) / dailyCap) : 0;

  const toggleStatus = async () => {
    const nextStatus = allowance.status === 'active' ? 'paused' : 'active';
    const previous = allowance;
    setAllowance({ ...allowance, status: nextStatus });
    setPending(true);
    setError(null);

    try {
      const updated = await apiRequest(`/allowances/${allowance.id}`, {
        method: 'PATCH',
        body: { status: nextStatus },
        schema: allowanceSchema,
      });
      setAllowance(updated);
    } catch (caught) {
      setAllowance(previous);
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display font-semibold text-text">{allowance.agentName}</p>
          <p className="truncate font-mono text-xs text-muted">{shortAddress(allowance.sessionAddress)}</p>
        </div>
        <Badge color={STATUS_BADGE[allowance.status]}>{allowance.status.toUpperCase()}</Badge>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Spent today</span>
          <span className="font-mono text-text">
            {formatUsd(spentToday)} / {formatUsd(dailyCap)}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${String(Math.min(100, progress))}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted">Per-call cap</p>
          <p className="font-mono text-text">{formatUsd(parseAtomic(allowance.perCallCap))}</p>
        </div>
        <div>
          <p className="text-muted">Session balance</p>
          <p className="font-mono text-text">{sessionBalance === null ? '—' : formatUsd(sessionBalance)}</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-error-400">
          {error}
        </p>
      )}

      <div className="mt-auto flex gap-2">
        <Link href={`/app/allowances/${allowance.id}`} className={`flex-1 ${buttonStyles('secondary')}`}>
          Open
        </Link>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={pending}
          onClick={() => void toggleStatus()}
        >
          {allowance.status === 'active' ? 'Pause' : 'Resume'}
        </Button>
      </div>
    </Card>
  );
};
