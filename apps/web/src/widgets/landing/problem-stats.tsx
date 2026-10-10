import { CreditCard, Globe, type LucideIcon, TimerReset } from 'lucide-react';

import { Card } from '@/components/ui/card';

const STATS: ReadonlyArray<{
  icon: LucideIcon;
  eyebrow: string;
  value: string;
  valueColor: string;
  title: string;
  body: string;
  before: string;
  after: string;
}> = [
  {
    icon: CreditCard,
    eyebrow: 'FIXED INTERCHANGE',
    value: '3,003%',
    valueColor: 'text-error-400',
    title: 'Card fee on a $0.01 API call',
    body: 'Traditional payment gateways charge $0.30 + 2.9% baseline fees. Paying for individual micro-tasks over legacy rails costs thirty times more than the execution itself.',
    before: 'Stripe baseline: $0.303',
    after: '402Lab: < $0.0001',
  },
  {
    icon: Globe,
    eyebrow: 'FX & CROSS-BORDER',
    value: '3.5% IOF',
    valueColor: 'text-warning-400',
    title: 'International card tax penalty',
    body: 'Cross-border taxes, bank exchange spreads, and local payment tariffs penalize global developers and autonomous agents querying US/EU inference endpoints.',
    before: 'Global FX haircut',
    after: 'Solana USDC: Direct 1:1',
  },
  {
    icon: TimerReset,
    eyebrow: 'CAPITAL LOCKUP',
    value: '$5–$50 min',
    valueColor: 'text-text',
    title: 'Prepaid balances that expire',
    body: 'Forcing agents to deposit $10 upfront for a single $0.002 query fragments developer liquidity across 40 disparate vendor dashboards with unused credits.',
    before: 'SaaS credits deadweight',
    after: 'Pure Pay-As-You-Go',
  },
];

export const ProblemStats = () => (
  <section id="pricing" className="scroll-mt-16 border-b border-line bg-surface/40">
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <span className="font-mono text-xs font-semibold tracking-wider text-error-400 uppercase">
            Legacy Friction
          </span>
          <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Why agents cannot hold credit cards
          </h2>
        </div>
        <p className="max-w-md text-muted">
          Micro-transactions under $0.05 are mathematically impossible on Visa and Mastercard
          rails due to interchange minimums and cross-border penalties.
        </p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {STATS.map(({ icon: Icon, eyebrow, value, valueColor, title, body, before, after }) => (
          <Card key={title} className="flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between">
                <span className={`font-mono text-xs font-medium ${valueColor}`}>{eyebrow}</span>
                <Icon aria-hidden="true" className={`size-5 ${valueColor}`} strokeWidth={1.75} />
              </div>
              <p className={`mt-4 font-display text-4xl font-semibold tracking-tight tabular-nums ${valueColor}`}>
                {value}
              </p>
              <h3 className="mt-2 font-semibold text-text">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-line pt-4 font-mono text-xs text-muted">
              <span>{before}</span>
              <span className="text-brand-400">{after}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  </section>
);
