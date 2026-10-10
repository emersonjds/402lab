import { SlidersHorizontal, Wallet, Zap, type LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';

const STEPS: ReadonlyArray<{
  icon: LucideIcon;
  phase: string;
  title: string;
  body: string;
  snippet: string;
}> = [
  {
    icon: SlidersHorizontal,
    phase: 'PHASE 01',
    title: 'Set an allowance',
    body: 'Configure per-request and per-hour spending boundaries. Guardrails are enforced via Solana PDA multisig contracts without granting agents blanket private key authority.',
    snippet: 'pda.set_limit(max_call: 0.05, daily: 10.0)',
  },
  {
    icon: Zap,
    phase: 'PHASE 02',
    title: 'Agent pays per call',
    body: 'Client initiates request. Upon receiving an HTTP 402 with an on-chain address and price header, the agent automatically signs the micro-transfer and retries in ~400ms.',
    snippet: '402: X-Solana-Pay: 0.005 USDC',
  },
  {
    icon: Wallet,
    phase: 'PHASE 03',
    title: 'Providers get paid',
    body: 'Revenue is credited directly to provider treasury addresses every single query. No invoice tracking, no net-30 delays, and zero chargeback arbitration risk.',
    snippet: 'USDC balance updated on-chain',
  },
];

export const HowItWorks = () => (
  <section id="how-it-works" className="scroll-mt-16 border-b border-line">
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="max-w-2xl">
        <span className="font-mono text-xs font-semibold tracking-wider text-brand-400 uppercase">
          Architecture Specification
        </span>
        <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
          Autonomous liquidity in three deterministic steps
        </h2>
        <p className="mt-2 text-muted">
          A cryptographic standard linking HTTP 402 status codes directly to Solana sub-second
          state settlement.
        </p>
      </div>
      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, phase, title, body, snippet }) => (
          <li key={phase}>
            <Card className="h-full p-6">
              <div className="flex size-10 items-center justify-center rounded-[6px] border border-line bg-raised text-brand-400">
                <Icon aria-hidden="true" className="size-6" strokeWidth={1.75} />
              </div>
              <p className="mt-6 font-mono text-xs font-semibold text-blue-light-400">{phase}</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-text">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
              <div className="mt-4 rounded-[6px] border border-line/60 bg-bg p-3 font-mono text-xs text-muted">
                <code>{snippet}</code>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  </section>
);
