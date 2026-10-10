import { Bot, Cpu, Database, ExternalLink, Search, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const ROWS: ReadonlyArray<{
  icon: LucideIcon;
  endpoint: string;
  ago: string;
  amount: string;
  signature: string;
}> = [
  { icon: Bot, endpoint: '/svc/vision-ocr', ago: '2s ago', amount: '$0.0050', signature: '5Jtx7..b49k' },
  { icon: Cpu, endpoint: '/svc/qwen-inference', ago: '7s ago', amount: '$0.0018', signature: '8Vp2X..vM7q' },
  { icon: Search, endpoint: '/svc/deep-research', ago: '14s ago', amount: '$0.0120', signature: '29AaK..92Xv' },
  { icon: Database, endpoint: '/svc/serp-crawl', ago: '29s ago', amount: '$0.0035', signature: '4Kp0m..77Qw' },
];

export const ProofPanel = () => (
  <section id="explorer" className="border-y border-line bg-surface/40">
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-brand-500" />
          <h2 className="font-display text-xl font-semibold text-text">Live Agent Payment Stream</h2>
          <span className="rounded-[6px] border border-line bg-surface px-2 py-0.5 font-mono text-xs text-blue-light-400">
            Devnet Cluster
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2">
          <span className="font-mono text-xs text-muted uppercase">Benchmark savings today:</span>
          <span className="font-mono text-sm font-bold tabular-nums text-brand-400">
            +$8,419.42 vs Card Rails
          </span>
        </div>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line bg-raised font-mono text-xs tracking-wide text-muted uppercase">
                <th scope="col" className="px-4 py-3">
                  Endpoint service
                </th>
                <th scope="col" className="px-4 py-3">
                  Timestamp
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Amount (USDC)
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Transaction proof
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 font-mono text-sm text-text">
              {ROWS.map(({ icon: Icon, endpoint, ago, amount, signature }) => (
                <tr key={endpoint} className="hover:bg-raised/50">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Icon aria-hidden="true" className="size-4 text-blue-light-400" strokeWidth={1.75} />
                      <span>{endpoint}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-muted">{ago}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{amount}</td>
                  <td className="px-4 py-3.5 text-center">
                    <Badge color="success">Paid ✓</Badge>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <a
                      href="#"
                      className="inline-flex items-center gap-1 text-blue-light-400 hover:underline"
                    >
                      {signature}
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line bg-raised/60 px-4 py-2.5 font-mono text-xs text-muted">
          <span>Displaying 4 of 241,809 devnet settlements</span>
          <span className="text-text">Solana Block #284,912,041</span>
        </div>
      </Card>
    </div>
  </section>
);
