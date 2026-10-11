import { SPLIT_WINDOW_MS } from '@402lab/mocks';

import type { SplitBatch } from '@/shared/api/schemas';

/** Average seconds between a payment settling and the `createdAt` of the split batch that paid
 * it out, across every confirmed batch the client has (`/splits` only ever returns the 50 most
 * recent — the same cap the real API has). `openapi.json` links a batch to its payments only
 * through time: each batch's payouts cover whatever settled in the `SPLIT_WINDOW_MS` before its
 * `createdAt`, so that window is how a payment is matched back to its batch without a field the
 * contract doesn't have. */
export const avgPaymentToPayoutSeconds = (
  payments: readonly { settledAt: string }[],
  batches: readonly Pick<SplitBatch, 'status' | 'createdAt'>[],
): number | null => {
  const windows = batches
    .filter((batch) => batch.status === 'confirmed')
    .map((batch) => {
      const end = new Date(batch.createdAt).getTime();
      return { start: end - SPLIT_WINDOW_MS, end };
    });
  if (windows.length === 0) return null;

  const earliestStart = Math.min(...windows.map((window) => window.start));
  const latestEnd = Math.max(...windows.map((window) => window.end));
  const settledTimes = payments
    .map((payment) => new Date(payment.settledAt).getTime())
    .filter((time) => time >= earliestStart && time < latestEnd);

  let totalSeconds = 0;
  let count = 0;
  for (const window of windows) {
    for (const settledAt of settledTimes) {
      if (settledAt < window.start || settledAt >= window.end) continue;
      totalSeconds += (window.end - settledAt) / 1_000;
      count += 1;
    }
  }

  return count === 0 ? null : totalSeconds / count;
};
