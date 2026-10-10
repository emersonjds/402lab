'use client';

import { cardCostEquivalent, formatUsd, parseAtomic, type AtomicAmount } from '@402lab/shared';
import Link from 'next/link';
import { useMemo } from 'react';

import { Alert } from '@/components/ui/alert';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { allowanceListSchema } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';

import { AllowanceCard } from './allowance-card';

interface SummaryStatProps {
  label: string;
  value: string;
  tone?: 'lime';
}

const SummaryStat = ({ label, value, tone }: SummaryStatProps) => (
  <Card className="p-5">
    <p className="text-sm text-muted">{label}</p>
    <p
      className={`mt-2 font-display text-title-sm font-bold ${tone === 'lime' ? 'text-brand-400' : 'text-text'}`}
    >
      {value}
    </p>
  </Card>
);

export const AllowancesList = () => {
  const query = useApiQuery('/allowances', allowanceListSchema);

  const summary = useMemo(() => {
    if (query.status !== 'ready') return null;

    const spentToday = query.data.allowances.reduce<AtomicAmount>(
      (sum, allowance) => sum + parseAtomic(allowance.spentToday),
      0n,
    );
    const active = query.data.allowances.filter((allowance) => allowance.status === 'active').length;

    return { spentToday, active, total: query.data.allowances.length, saved: cardCostEquivalent(spentToday) - spentToday };
  }, [query]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-title-sm font-bold tracking-tight text-text">Allowances</h1>
          <p className="mt-1 text-sm text-muted">Budgets your agents spend from, one call at a time.</p>
        </div>
        <Link href="/app/allowances/new" className={buttonStyles('primary')}>
          Create allowance
        </Link>
      </div>

      {summary && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <SummaryStat label="Total spent today" value={formatUsd(summary.spentToday)} />
          <SummaryStat label="Agents active" value={`${String(summary.active)} / ${String(summary.total)}`} />
          <SummaryStat label="Saved vs. card" value={formatUsd(summary.saved)} tone="lime" />
        </div>
      )}

      <div className="mt-6">
        {query.status === 'loading' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <Card key={key} className="h-56 animate-pulse" />
            ))}
          </div>
        )}

        {query.status === 'error' && (
          <Alert variant="error" title="Couldn't load your allowances">
            {query.message}
          </Alert>
        )}

        {query.status === 'ready' && query.data.allowances.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted">
            No allowances yet. Create one to give an agent a budget.
          </Card>
        )}

        {query.status === 'ready' && query.data.allowances.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.allowances.map((allowance) => (
              <AllowanceCard key={allowance.id} allowance={allowance} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
