'use client';

import { formatUsd, parseAtomic } from '@402lab/shared';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SolscanLink } from '@/components/ui/solscan-link';
import { useAllPayments } from '@/shared/api/use-all-payments';
import { serviceInfo, serviceLabel } from '@/shared/catalog/service-info';
import { ProviderIcon } from '@/shared/ui/provider-icon';

// Rendering tens of thousands of rows at once freezes the tab; the full list still feeds the totals.
const ROWS_PER_PAGE = 100;

export const PaymentsTable = () => {
  const query = useAllPayments();
  const [shown, setShown] = useState(ROWS_PER_PAGE);
  const all = query.status === 'ready' ? query.payments : null;
  const rows = all?.slice(0, shown) ?? null;

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
        {rows === null && query.status === 'loading' && (
          <p className="text-sm text-muted">Loading…</p>
        )}
        {rows !== null && rows.length === 0 && (
          <p className="text-sm text-muted">No payments yet.</p>
        )}
        {all !== null && all.length > 0 && (
          <p className="mb-3 text-xs text-muted">
            Showing the latest {rows?.length ?? 0} of {all.length} payments.
          </p>
        )}

        {rows !== null && rows.length > 0 && (
          <>
            <ul className="grid gap-2 sm:hidden">
              {rows.map((row) => (
                <li key={row.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">{row.agentName}</span>
                    <span className="font-mono text-sm text-text">
                      {formatUsd(parseAtomic(row.amount))}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <ProviderIcon provider={serviceInfo(row.serviceId).provider} size={12} />
                      {serviceLabel(row.serviceId)}
                    </span>
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
                      <td className="py-2.5 text-text">
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex size-7 items-center justify-center rounded-full bg-raised text-text">
                            <ProviderIcon provider={serviceInfo(row.serviceId).provider} />
                          </span>
                          {serviceLabel(row.serviceId)}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-text">
                        {formatUsd(parseAtomic(row.amount))}
                      </td>
                      <td className="py-2.5 text-muted">
                        {new Date(row.settledAt).toLocaleString()}
                      </td>
                      <td className="py-2.5">
                        <SolscanLink signature={row.txSignature} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {all !== null && shown < all.length && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShown((count) => count + ROWS_PER_PAGE);
                  }}
                >
                  Show more
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};
