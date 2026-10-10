'use client';

import { formatUsd, parseAtomic } from '@402lab/shared';
import { useState } from 'react';

import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiError, apiRequest } from '@/shared/api/client';
import { allowanceSchema, type Allowance } from '@/shared/api/schemas';
import { shortAddress } from '@/shared/format/address';

const STATUS_BADGE: Record<Allowance['status'], BadgeColor> = { active: 'success', paused: 'warning' };

interface StatusHeaderProps {
  allowance: Allowance;
  onUpdate: (next: Allowance) => void;
}

export const StatusHeader = ({ allowance, onUpdate }: StatusHeaderProps) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleStatus = async () => {
    const nextStatus = allowance.status === 'active' ? 'paused' : 'active';
    const previous = allowance;
    onUpdate({ ...allowance, status: nextStatus });
    setPending(true);
    setError(null);

    try {
      const updated = await apiRequest(`/allowances/${allowance.id}`, {
        method: 'PATCH',
        body: { status: nextStatus },
        schema: allowanceSchema,
      });
      onUpdate(updated);
    } catch (caught) {
      onUpdate(previous);
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate font-display text-title-sm font-bold tracking-tight text-text">
              {allowance.agentName}
            </h1>
            <Badge color={STATUS_BADGE[allowance.status]}>{allowance.status.toUpperCase()}</Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-muted">PDA: {shortAddress(allowance.sessionAddress)}</p>
        </div>

        <div className="flex items-center gap-2 text-right">
          <div className="hidden text-xs text-muted sm:block">
            <p>
              Cap {formatUsd(parseAtomic(allowance.perCallCap))}/call · Daily{' '}
              {formatUsd(parseAtomic(allowance.dailyCap))}
            </p>
          </div>
          <Button variant="secondary" disabled={pending} onClick={() => void toggleStatus()}>
            {allowance.status === 'active' ? 'Pause agent' : 'Resume agent'}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-error-400">
          {error}
        </p>
      )}
    </div>
  );
};
