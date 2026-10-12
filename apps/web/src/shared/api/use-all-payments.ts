'use client';

import { skipToken, useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';
import { allowanceListSchema, paymentListSchema, type Allowance, type Payment } from './schemas';
import { useApiQuery } from './use-api-query';

export type PaymentWithAgent = Payment & { agentName: string; allowanceId: string };

export type AllPaymentsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payments: PaymentWithAgent[]; allowances: Allowance[] };

/** Safety ceiling on pages per allowance: the API caps a page at 50 payments, so this bounds one
 * allowance's history at 10,000 payments without risking an infinite loop on a buggy cursor. */
const MAX_PAGES_PER_ALLOWANCE = 200;

/** Follows the `after` cursor until the API returns a page short of 50 (the last page) or the
 * safety ceiling is hit, one request at a time so each page's cursor is known before the next. */
const fetchAllPaymentsFor = async (
  allowance: Allowance,
  signal: AbortSignal,
): Promise<PaymentWithAgent[]> => {
  const collected: PaymentWithAgent[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES_PER_ALLOWANCE; page += 1) {
    const query = after ? `?after=${after}` : '';
    const result = await apiRequest(`/allowances/${allowance.id}/payments${query}`, {
      schema: paymentListSchema,
      signal,
    });

    for (const payment of result.payments) {
      collected.push({ ...payment, agentName: allowance.agentName, allowanceId: allowance.id });
    }

    const last = result.payments[result.payments.length - 1];
    if (!last || result.payments.length < 50) break;
    after = last.id;
  }

  return collected;
};

/** Fetches every allowance's full payment history (paging past the API's 50-per-page cap) and
 * flattens it into one list, newest first — the cross-agent view that Payments, Overview and the
 * provider splits leaderboard all need. Allowances are fetched in parallel; each allowance's own
 * pages are fetched in sequence since a later page's cursor depends on the one before it. */
export const useAllPayments = (): AllPaymentsState => {
  const allowancesQuery = useApiQuery('/allowances', allowanceListSchema);
  const allowances = allowancesQuery.status === 'ready' ? allowancesQuery.data.allowances : null;
  const paymentsQuery = useQuery({
    queryKey: ['all-payments', allowances?.map((allowance) => allowance.id).sort()],
    queryFn:
      allowances === null
        ? skipToken
        : async ({ signal }) => {
            const lists = await Promise.all(
              allowances.map((allowance) => fetchAllPaymentsFor(allowance, signal)),
            );
            return lists.flat().sort((a, b) => b.settledAt.localeCompare(a.settledAt));
          },
    staleTime: 30_000,
  });

  if (allowancesQuery.status === 'error')
    return { status: 'error', message: allowancesQuery.message };
  if (paymentsQuery.status === 'error')
    return { status: 'error', message: 'Something went wrong loading payments.' };
  if (allowances === null || paymentsQuery.status !== 'success') return { status: 'loading' };
  return { status: 'ready', payments: paymentsQuery.data, allowances };
};
