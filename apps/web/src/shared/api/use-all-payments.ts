'use client';

import { useEffect, useState } from 'react';

import { apiRequest } from './client';
import { allowanceListSchema, paymentListSchema, type Allowance, type Payment } from './schemas';
import { useApiQuery } from './use-api-query';

export type PaymentWithAgent = Payment & { agentName: string; allowanceId: string };

export type AllPaymentsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payments: PaymentWithAgent[]; allowances: Allowance[] };

/** Fetches every allowance's payment history and flattens it into one list, newest first — the
 * cross-agent view that Payments, Overview and the provider splits leaderboard all need. */
export const useAllPayments = (): AllPaymentsState => {
  const allowancesQuery = useApiQuery('/allowances', allowanceListSchema);
  const [state, setState] = useState<AllPaymentsState>({ status: 'loading' });

  useEffect(() => {
    if (allowancesQuery.status !== 'ready') return undefined;

    let cancelled = false;
    const { allowances } = allowancesQuery.data;

    Promise.all(
      allowances.map((allowance) =>
        apiRequest(`/allowances/${allowance.id}/payments`, { schema: paymentListSchema }).then(
          (result) =>
            result.payments.map((payment) => ({
              ...payment,
              agentName: allowance.agentName,
              allowanceId: allowance.id,
            })),
        ),
      ),
    )
      .then((lists) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          payments: lists.flat().sort((a, b) => b.settledAt.localeCompare(a.settledAt)),
          allowances,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: 'Something went wrong loading payments.' });
      });

    return () => {
      cancelled = true;
    };
  }, [allowancesQuery]);

  if (allowancesQuery.status === 'error') return { status: 'error', message: allowancesQuery.message };
  return state;
};
