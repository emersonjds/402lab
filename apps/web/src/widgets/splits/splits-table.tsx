'use client';

import { formatUsd, parseAtomic } from '@402lab/shared';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SolscanLink } from '@/components/ui/solscan-link';
import { splitBatchListSchema, type SplitBatch } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';
import { shortAddress } from '@/shared/format/address';

const STATUS_BADGE: Record<SplitBatch['status'], BadgeColor> = {
  confirmed: 'success',
  pending: 'warning',
  failed: 'error',
};

const ROLE_LABEL: Record<SplitBatch['payouts'][number]['role'], string> = {
  provider: 'Provider',
  integrator: 'Integrator',
  platform: 'Platform',
};

const batchTotal = (batch: SplitBatch): bigint =>
  batch.payouts.reduce((sum, payout) => sum + parseAtomic(payout.amount), 0n);

const BatchCard = ({ batch }: { batch: SplitBatch }) => (
  <Card className="p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="font-mono text-xs text-muted">{new Date(batch.createdAt).toLocaleString()}</p>
        <p className="mt-1 font-mono text-lg font-bold text-text">{formatUsd(batchTotal(batch))}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge color={STATUS_BADGE[batch.status]}>{batch.status.toUpperCase()}</Badge>
        <SolscanLink signature={batch.txSignature} />
      </div>
    </div>

    <ul className="mt-4 grid gap-1.5 border-t border-line pt-4">
      {batch.payouts.map((payout) => (
        <li
          key={`${payout.role}:${payout.recipient}`}
          className="flex items-center justify-between text-sm"
        >
          <span className="text-muted">
            {ROLE_LABEL[payout.role]} · <span className="font-mono">{shortAddress(payout.recipient)}</span>
          </span>
          <span className="font-mono text-text">{formatUsd(parseAtomic(payout.amount))}</span>
        </li>
      ))}
    </ul>
  </Card>
);

export const SplitsTable = () => {
  const query = useApiQuery('/splits', splitBatchListSchema);

  return (
    <div>
      <h1 className="font-display text-title-sm font-bold tracking-tight text-text">Splits</h1>
      <p className="mt-1 text-sm text-muted">
        Every batch the treasury settled to providers, integrators and the platform.
      </p>

      <div className="mt-6 grid gap-4">
        {query.status === 'loading' &&
          [0, 1].map((key) => <Card key={key} className="h-40 animate-pulse" />)}

        {query.status === 'error' && (
          <Alert variant="error" title="Couldn't load splits">
            {query.message}
          </Alert>
        )}

        {query.status === 'ready' && query.data.batches.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted">No settlements yet.</Card>
        )}

        {query.status === 'ready' &&
          query.data.batches.map((batch) => <BatchCard key={batch.id} batch={batch} />)}
      </div>
    </div>
  );
};
