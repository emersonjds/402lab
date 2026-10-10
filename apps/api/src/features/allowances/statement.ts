import {
  cardCostEquivalent,
  computeSplit,
  type Service,
  serviceIdSchema,
  type SplitRole,
} from '@402lab/shared';

import type { PaymentRow } from '../../shared/db/schema.js';
import type { PaymentView, Statement } from './schemas.js';

export const monthRange = (month: string): { from: Date; to: Date } => {
  const [year = 0, monthNumber = 0] = month.split('-').map(Number);

  return {
    from: new Date(Date.UTC(year, monthNumber - 1, 1)),
    to: new Date(Date.UTC(year, monthNumber, 1)),
  };
};

export const toPaymentView = (payment: PaymentRow): PaymentView => ({
  id: payment.id,
  serviceId: serviceIdSchema.parse(payment.serviceId),
  amount: payment.amount.toString(),
  txSignature: payment.txSignature,
  settledAt: payment.settledAt.toISOString(),
  upstreamStatus: payment.upstreamStatus,
});

const sum = (amounts: bigint[]): bigint => amounts.reduce((total, amount) => total + amount, 0n);

/** Split per payment, as the worker pays it: rounding happens on each payment, not on the month. */
export const buildStatement = (
  month: string,
  payments: PaymentRow[],
  catalog: Service[],
): Statement => {
  const byRecipient = new Map<string, { recipient: string; role: SplitRole; amount: bigint }>();

  const byService = catalog
    .map((service) => {
      const ofService = payments.filter((payment) => payment.serviceId === service.id);

      for (const payment of ofService) {
        for (const line of computeSplit(payment.amount, service.splits)) {
          const key = `${line.role}:${line.recipient}`;
          const previous = byRecipient.get(key)?.amount ?? 0n;
          byRecipient.set(key, { ...line, amount: previous + line.amount });
        }
      }

      return {
        serviceId: service.id,
        count: ofService.length,
        amount: sum(ofService.map((payment) => payment.amount)).toString(),
      };
    })
    .filter(({ count }) => count > 0);

  return {
    month,
    totals: {
      amount: sum(payments.map((payment) => payment.amount)).toString(),
      cardEquivalent: sum(payments.map((payment) => cardCostEquivalent(payment.amount))).toString(),
      byService,
      byProvider: [...byRecipient.values()].map((line) => ({
        ...line,
        amount: line.amount.toString(),
      })),
    },
    payments: payments.map(toPaymentView),
  };
};
