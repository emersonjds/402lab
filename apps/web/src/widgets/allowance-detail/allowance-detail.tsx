'use client';

import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { allowanceSchema, paymentListSchema, type Allowance } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';

import { KpiRow } from './kpi-row';
import { LiveFeed } from './live-feed';
import { PairPhoneCard } from './pair-phone-card';
import { SpendChart } from './spend-chart';
import { SplitsCard } from './splits-card';
import { StatusHeader } from './status-header';

interface AllowanceDetailProps {
  allowanceId: string;
}

export const AllowanceDetail = ({ allowanceId }: AllowanceDetailProps) => {
  const query = useApiQuery(`/allowances/${allowanceId}`, allowanceSchema);
  const paymentsQuery = useApiQuery(`/allowances/${allowanceId}/payments`, paymentListSchema);
  const [override, setOverride] = useState<Allowance | null>(null);

  if (query.status === 'loading') {
    return <div className="grid gap-4">{[0, 1].map((key) => <Card key={key} className="h-24 animate-pulse" />)}</div>;
  }

  if (query.status === 'error') {
    return (
      <Alert variant="error" title="Couldn't load this agent">
        {query.message}
      </Alert>
    );
  }

  const allowance = override ?? query.data;
  const payments = paymentsQuery.status === 'ready' ? paymentsQuery.data.payments : [];

  return (
    <div className="grid gap-6">
      <StatusHeader allowance={allowance} onUpdate={setOverride} />
      <KpiRow allowance={allowance} payments={payments} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          <SpendChart payments={payments} />
          <LiveFeed allowanceId={allowance.id} />
        </div>
        <div className="grid gap-6">
          <SplitsCard />
          <PairPhoneCard />
        </div>
      </div>
    </div>
  );
};
