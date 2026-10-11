'use client';

import { cardCostEquivalent, formatUsd, parseAtomic } from '@402lab/shared';

import { Card } from '@/components/ui/card';
import type { Allowance, Payment } from '@/shared/api/schemas';
import { useSessionUsdcBalance } from '@/shared/wallet/session-balance';

interface KpiRowProps {
  allowance: Allowance;
  payments: Payment[];
}

const Kpi = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <Card className="p-4">
    <p className="text-xs text-muted">{label}</p>
    <p className="mt-1.5 font-mono text-xl font-bold text-text">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
  </Card>
);

const isToday = (iso: string): boolean => {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
};

export const KpiRow = ({ allowance, payments }: KpiRowProps) => {
  const spentToday = parseAtomic(allowance.spentToday);
  const dailyCap = parseAtomic(allowance.dailyCap);
  const progress = dailyCap > 0n ? Math.min(100, Number((spentToday * 100n) / dailyCap)) : 0;
  const callsToday = payments.filter((payment) => isToday(payment.settledAt)).length;
  const saved = cardCostEquivalent(spentToday) - spentToday;
  const sessionBalance = useSessionUsdcBalance(allowance.sessionAddress);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Kpi label="Spent today" value={formatUsd(spentToday)} hint={`${String(progress)}% of ${formatUsd(dailyCap)} cap`} />
      <Kpi label="Calls today" value={String(callsToday)} />
      <Kpi label="Saved vs. card" value={formatUsd(saved)} />
      <Kpi
        label="Session balance"
        value={sessionBalance === null ? '—' : formatUsd(sessionBalance)}
        hint="USDC devnet"
      />
    </div>
  );
};
