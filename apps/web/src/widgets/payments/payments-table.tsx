'use client';

import { formatUsd, parseAtomic } from '@402lab/shared';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { SolscanLink } from '@/components/ui/solscan-link';
import { apiRequest } from '@/shared/api/client';
import { allowanceListSchema, paymentListSchema, type Payment } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';
import { serviceLabel } from '@/shared/catalog/service-info';

type Row = Payment & { agentName: string };

export const PaymentsTable = () => {
  const allowancesQuery = useApiQuery('/allowances', allowanceListSchema);
  const allowances = allowancesQuery.status === 'ready' ? allowancesQuery.data.allowances : null;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowances) return undefined;

    let cancelled = false;
    Promise.all(
      allowances.map((allowance) =>
        apiRequest(`/allowances/${allowance.id}/payments`, { schema: paymentListSchema }).then((result) =>
          result.payments.map((payment) => ({ ...payment, agentName: allowance.agentName })),
        ),
      ),
    )
      .then((lists) => {
        if (!cancelled) setRows(lists.flat().sort((a, b) => b.settledAt.localeCompare(a.settledAt)));
      })
      .catch(() => {
        if (!cancelled) setError('Something went wrong loading payments.');
      });

    return () => {
      cancelled = true;
    };
  }, [allowances]);

  return (
    <div>
      <h1 className="font-display text-title-sm font-bold tracking-tight text-text">Payments</h1>
      <p className="mt-1 text-sm text-muted">Every call your agents paid for, across allowances.</p>

      <Card className="mt-6 p-5">
        {allowancesQuery.status === 'error' && (
          <Alert variant="error" title="Couldn't load allowances">
            {allowancesQuery.message}
          </Alert>
        )}
        {error && (
          <Alert variant="error" title="Couldn't load payments">
            {error}
          </Alert>
        )}
        {rows === null && !error && allowancesQuery.status !== 'error' && (
          <p className="text-sm text-muted">Loading…</p>
        )}
        {rows !== null && rows.length === 0 && <p className="text-sm text-muted">No payments yet.</p>}

        {rows !== null && rows.length > 0 && (
          <>
            <ul className="grid gap-2 sm:hidden">
              {rows.map((row) => (
                <li key={row.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">{row.agentName}</span>
                    <span className="font-mono text-sm text-text">{formatUsd(parseAtomic(row.amount))}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{serviceLabel(row.serviceId)}</span>
                    <span>{new Date(row.settledAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1">
                    <SolscanLink signature={row.txSignature} />
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="py-2 font-medium">Agent</th>
                    <th className="py-2 font-medium">Service</th>
                    <th className="py-2 font-medium">Amount</th>
                    <th className="py-2 font-medium">Settled</th>
                    <th className="py-2 font-medium">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-line/60">
                      <td className="py-2.5 text-text">{row.agentName}</td>
                      <td className="py-2.5 text-text">{serviceLabel(row.serviceId)}</td>
                      <td className="py-2.5 font-mono text-text">{formatUsd(parseAtomic(row.amount))}</td>
                      <td className="py-2.5 text-muted">{new Date(row.settledAt).toLocaleString()}</td>
                      <td className="py-2.5">
                        <SolscanLink signature={row.txSignature} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
