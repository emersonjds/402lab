import { SlidersHorizontal, Split, Zap, type LucideIcon } from 'lucide-react';

const STEPS: ReadonlyArray<{ icon: LucideIcon; title: string; detail: string }> = [
  { icon: SlidersHorizontal, title: 'Set an allowance', detail: 'per-call and daily caps.' },
  {
    icon: Zap,
    title: 'Your agent pays per call',
    detail: 'HTTP 402 + USDC on Solana, settled in ~1s.',
  },
  {
    icon: Split,
    title: 'Providers get paid automatically',
    detail: 'revenue split on-chain every 30 seconds.',
  },
];

export const HowItWorks = () => (
  <section
    id="how-it-works"
    aria-labelledby="how-title"
    className="scroll-mt-16 border-b border-line"
  >
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <h2 id="how-title" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        How it works
      </h2>
      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        {STEPS.map(({ icon: Icon, title, detail }, index) => (
          <li key={title} className="relative border-t border-line pt-6">
            <span aria-hidden="true" className="absolute -top-px left-0 h-px w-12 bg-lime" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-lime">{`0${String(index + 1)}`}</span>
              <Icon aria-hidden="true" className="size-5 text-muted" strokeWidth={1.75} />
            </div>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              <strong className="font-display font-medium text-text">{title}</strong> — {detail}
            </p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);
