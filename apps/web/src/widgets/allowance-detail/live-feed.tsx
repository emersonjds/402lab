'use client';

import { formatUsd, parseAtomic, type LiveEvent } from '@402lab/shared';
import { useCallback, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { SolscanLink } from '@/components/ui/solscan-link';
import { paymentListSchema, type Payment } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';
import { useLiveEvents } from '@/shared/api/use-live-events';

interface LiveFeedProps {
  allowanceId: string;
}

const SERVICE_LABEL: Record<Payment['serviceId'], string> = {
  ocr: 'OCR · Azure',
  translate: 'Translate · AWS',
  summarize: 'Summarize · Anthropic',
};

const HIGHLIGHT_MS = 2_500;

export const LiveFeed = ({ allowanceId }: LiveFeedProps) => {
  const query = useApiQuery(`/allowances/${allowanceId}/payments`, paymentListSchema);
  const [livePayments, setLivePayments] = useState<Payment[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const handleEvent = useCallback(
    (event: LiveEvent) => {
      if (event.type !== 'payment.settled' || event.allowanceId !== allowanceId) return;

      setLivePayments((previous) => [
        {
          id: event.paymentId,
          serviceId: event.serviceId,
          amount: event.amount,
          txSignature: event.txSignature,
          settledAt: event.settledAt,
          upstreamStatus: '200',
        },
        ...previous,
      ]);
      setHighlightId(event.paymentId);
      setTimeout(() => {
        setHighlightId((current) => (current === event.paymentId ? null : current));
      }, HIGHLIGHT_MS);
    },
    [allowanceId],
  );

  useLiveEvents(handleEvent);

  const fetched = query.status === 'ready' ? query.data.payments : [];
  const knownIds = new Set(livePayments.map((payment) => payment.id));
  const rows = [...livePayments, ...fetched.filter((payment) => !knownIds.has(payment.id))]
    .sort((a, b) => b.settledAt.localeCompare(a.settledAt))
    .slice(0, 20);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-text">Live payments</h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-400">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-400" aria-hidden="true" />
          Real-time
        </span>
      </div>

      {query.status === 'error' && (
        <Alert variant="error" title="Couldn't load payments">
          {query.message}
        </Alert>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No calls yet.</p>
      ) : (
        <>
          <ul className="mt-4 grid gap-2 sm:hidden">
            {rows.map((payment) => (
              <li
                key={payment.id}
                className={`rounded-lg border border-line p-3 transition-colors duration-500 ${
                  highlightId === payment.id ? 'bg-brand-500/10' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text">{SERVICE_LABEL[payment.serviceId]}</span>
                  <span className="font-mono text-sm text-text">{formatUsd(parseAtomic(payment.amount))}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted">
                  <span>{new Date(payment.settledAt).toLocaleTimeString()}</span>
                  <SolscanLink signature={payment.txSignature} />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 font-medium">Service</th>
                  <th className="py-2 font-medium">Amount</th>
                  <th className="py-2 font-medium">Settled</th>
                  <th className="py-2 font-medium">Tx</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((payment) => (
                  <tr
                    key={payment.id}
                    className={`border-b border-line/60 transition-colors duration-500 ${
                      highlightId === payment.id ? 'bg-brand-500/10' : ''
                    }`}
                  >
                    <td className="py-2.5 text-text">{SERVICE_LABEL[payment.serviceId]}</td>
                    <td className="py-2.5 font-mono text-text">{formatUsd(parseAtomic(payment.amount))}</td>
                    <td className="py-2.5 text-muted">{new Date(payment.settledAt).toLocaleTimeString()}</td>
                    <td className="py-2.5">
                      <SolscanLink signature={payment.txSignature} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
};
