import { cardCostEquivalent, type AtomicAmount } from '@402lab/shared';

import { Card } from '@/shared/ui/card';
import { Money } from '@/shared/ui/money';
import { Pill } from '@/shared/ui/pill';

const EXAMPLE_PAYMENTS: ReadonlyArray<{ service: string; amount: AtomicAmount; ago: string }> = [
  { service: 'Summarize', amount: 10_000n, ago: '2s ago' },
  { service: 'Translate', amount: 2_000n, ago: '3s ago' },
  { service: 'OCR', amount: 5_000n, ago: '4s ago' },
];

const sum = (amounts: AtomicAmount[]): AtomicAmount =>
  amounts.reduce((total, amount) => total + amount, 0n);

const spent = sum(EXAMPLE_PAYMENTS.map(({ amount }) => amount));
const cardTotal = sum(EXAMPLE_PAYMENTS.map(({ amount }) => cardCostEquivalent(amount)));

export const ProofPanel = () => (
  <section aria-labelledby="proof-title" className="border-b border-line">
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.2fr] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2
            id="proof-title"
            className="font-display text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Live proof
          </h2>
          <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-xs text-muted">
            Example data
          </span>
        </div>
        <p className="mt-8 text-muted">You saved</p>
        <p className="mt-1 font-display text-5xl font-bold tracking-tight text-lime sm:text-6xl">
          <Money amount={cardTotal - spent} />
        </p>
        <p className="mt-2 text-muted">vs card + IOF</p>
        <p className="mt-8 max-w-sm text-sm text-muted">
          Three calls, <Money amount={spent} className="text-text" /> spent. Every live payment
          links to its transaction on Solscan.
        </p>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Example payments by an agent</caption>
          <thead className="border-b border-line font-mono text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-normal">
                Service
              </th>
              <th scope="col" className="px-2 py-3 text-right font-normal">
                Paid
              </th>
              <th scope="col" className="px-2 py-3 text-right font-normal">
                Card + IOF
              </th>
              <th scope="col" className="hidden px-4 py-3 font-normal sm:table-cell">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {EXAMPLE_PAYMENTS.map(({ service, amount, ago }) => (
              <tr key={service}>
                <th scope="row" className="px-4 py-3 font-medium">
                  {service}
                  <span className="block font-mono text-xs font-normal text-muted">{ago}</span>
                </th>
                <td className="px-2 py-3 text-right">
                  <Money amount={amount} className="text-lime" />
                </td>
                <td className="px-2 py-3 text-right">
                  <s className="text-muted">
                    <Money amount={cardCostEquivalent(amount)} />
                  </s>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <Pill status="settled" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  </section>
);
