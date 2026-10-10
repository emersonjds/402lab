'use client';

import { formatUsd, parseAtomic } from '@402lab/shared';
import Link from 'next/link';

import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { splitBatchListSchema, type SplitBatch } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';

const STATUS_BADGE: Record<SplitBatch['status'], BadgeColor> = {
  confirmed: 'success',
  pending: 'warning',
  failed: 'error',
};

const batchTotal = (batch: SplitBatch): bigint =>
  batch.payouts.reduce((sum, payout) => sum + parseAtomic(payout.amount), 0n);

export const SplitsCard = () => {
  const query = useApiQuery('/splits', splitBatchListSchema);
  const batches = query.status === 'ready' ? query.data.batches.slice(0, 3) : [];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-text">Automated revenue splits</h2>
        <Link href="/app/splits" className="text-xs text-blue-light-400 hover:underline">
          View all
        </Link>
      </div>

      {query.status === 'loading' && <p className="mt-4 text-sm text-muted">Loading…</p>}
      {query.status === 'ready' && batches.length === 0 && (
        <p className="mt-4 text-sm text-muted">No settlements yet.</p>
      )}

      <ul className="mt-4 grid gap-3">
        {batches.map((batch) => (
          <li key={batch.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-muted">{batch.payouts.length} payouts</p>
              <p className="text-xs text-muted">{new Date(batch.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-text">{formatUsd(batchTotal(batch))}</span>
              <Badge color={STATUS_BADGE[batch.status]}>{batch.status.toUpperCase()}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};
