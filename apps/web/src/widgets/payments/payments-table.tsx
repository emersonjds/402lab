'use client';

import { formatUsd, parseAtomic } from '@402lab/shared';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { SolscanLink } from '@/components/ui/solscan-link';
import { useAllPayments } from '@/shared/api/use-all-payments';
import { serviceLabel } from '@/shared/catalog/service-info';

export const PaymentsTable = () => {
  const query = useAllPayments();
  const rows = query.status === 'ready' ? query.payments : null;

  return (
    <div>
      <h1 className="font-display text-title-sm font-bold tracking-tight text-text">Payments</h1>
      <p className="mt-1 text-sm text-muted">Every call your agents paid for, across allowances.</p>

      <Card className="mt-6 p-5">
        {query.status === 'error' && (
          <Alert variant="error" title="Couldn't load payments">
            {query.message}
          </Alert>
        )}
        {rows === null && query.status === 'loading' && <p className="text-sm text-muted">Loading…</p>}
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
