import { buttonStyles } from '@/components/ui/button';

type Tone = 'plain' | 'error' | 'brand' | 'blue';

const TONES: Record<Tone, string> = {
  plain: 'text-muted',
  error: 'text-error-400 font-medium',
  brand: 'text-brand-400',
  blue: 'text-blue-light-400',
};

const RUN: ReadonlyArray<{
  request: string;
  status: readonly [string, Tone];
  paid: string;
  signature: string;
  latency: string;
}> = [
  {
    request: '> GET /svc/ocr',
    status: ['402 REQUIRED', 'error'],
    paid: 'paid 0.0050 USDC · sig',
    signature: '5Jtx..7kQ',
    latency: '✓ 412ms',
  },
  {
    request: '> GET /svc/translate',
    status: ['402 REQUIRED', 'error'],
    paid: 'paid 0.0020 USDC · sig',
    signature: '8Vp2..9mX',
    latency: '✓ 388ms',
  },
  {
    request: '> GET /svc/summarize',
    status: ['402 REQUIRED', 'error'],
    paid: 'paid 0.0100 USDC · sig',
    signature: '3Kaa..2Lz',
    latency: '✓ 431ms',
  },
];

const LINE_DELAY_MS = 500;

const Terminal = () => (
  <figure
    aria-label="Example agent run"
    className="relative min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_30px_80px_-40px_color-mix(in_oklab,var(--color-brand-500)_35%,transparent)]"
  >
    <div className="flex items-center justify-between border-b border-line bg-raised px-4 py-3">
      <div aria-hidden="true" className="flex gap-1.5">
        <span className="size-3 rounded-full bg-error-500" />
        <span className="size-3 rounded-full bg-warning-400" />
        <span className="size-3 rounded-full bg-brand-500" />
      </div>
      <span className="font-mono text-xs text-muted">agent-session-8f3a.log</span>
      <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-brand-500/20 bg-surface px-2 py-0.5 font-mono text-xs text-brand-400">
        <span aria-hidden="true" className="size-1.5 animate-ping rounded-full bg-brand-500" />
        412ms avg
      </span>
    </div>
    <ol className="grid gap-3 p-4 font-mono text-xs leading-relaxed sm:p-5 sm:text-sm">
      {RUN.map(({ request, status, paid, signature, latency }, index) => (
        <li
          key={request}
          className="flex animate-type-in flex-col gap-1 border-b border-line/40 pb-2.5"
          style={{ animationDelay: `${String(300 + index * LINE_DELAY_MS)}ms` }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted">{request}</span>
            <span className={TONES[status[1]]}>{status[0]}</span>
          </div>
          <div className="flex items-center justify-between gap-2 border-l border-brand-500/50 pl-3 text-xs">
            <span className="text-text">
              {paid} <span className={TONES.blue}>{signature}</span>
            </span>
            <span className={TONES.brand}>{latency}</span>
          </div>
        </li>
      ))}
    </ol>
    <div className="flex flex-col gap-2 px-4 pb-4 sm:px-5">
      <div className="flex items-center justify-between font-mono text-xs text-muted">
        <span>SESSION RUNTIME USAGE:</span>
        <span className="font-mono text-sm font-semibold text-text">$0.0170 USDC</span>
      </div>
      <div className="flex items-center justify-between rounded-[6px] border border-line bg-raised/60 p-2.5">
        <span className="font-mono text-xs text-error-400 line-through">$0.9500 (Card + IOF)</span>
        <span className="rounded-[6px] border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-brand-400">
          +98.2% SAVED
        </span>
      </div>
    </div>
    <div className="flex items-center justify-between border-t border-line bg-raised px-4 py-2 font-mono text-xs text-muted">
      <span>Solana PDA: 7dK4...bN91</span>
      <span className="text-blue-light-400">Signature Verified</span>
    </div>
  </figure>
);

export const Hero = () => (
  <section className="relative isolate overflow-hidden border-b border-line">
    <div
      aria-hidden="true"
      className="bg-ledger-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_80%_70%_at_30%_20%,black,transparent)]"
    />
    <div className="mx-auto grid max-w-7xl gap-12 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-16 lg:py-20">
      <div className="min-w-0 lg:col-span-7">
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-line bg-surface p-1">
          <span className="rounded-full bg-raised px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide text-blue-light-400">
            SOLANA DEVNET
          </span>
          <span className="rounded-full bg-raised px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide text-brand-400">
            HTTP 402 PROTOCOL
          </span>
          <span className="hidden rounded-full px-2.5 py-0.5 font-mono text-xs text-muted sm:inline-block">
            AUTONOMOUS SETTLEMENT
          </span>
        </div>
        <h1 className="mt-6 max-w-2xl font-display text-4xl leading-[1.05] font-semibold tracking-tight text-text sm:text-5xl lg:text-6xl">
          The spending account for{' '}
          <span className="font-mono text-brand-500 tracking-tighter">&lt;AI agents/&gt;</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Give your agent an on-chain budget cap. It pays any API per call in USDC on Solana. No
          credit cards, no signup forms, no surprise monthly invoices.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href="#waitlist" className={buttonStyles()}>
            Join the waitlist
          </a>
          <a href="#how-it-works" className={buttonStyles('secondary')}>
            Watch the 60s demo
          </a>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/60 pt-4 font-mono text-xs text-muted">
          <span className="flex items-center gap-1.5 text-brand-400">
            ⚡ Instant settlement (~400ms)
          </span>
          <span className="text-line">·</span>
          <span>Zero card interchange</span>
          <span className="text-line">·</span>
          <span>Designed for Autonomous LLMs</span>
        </div>
      </div>
      <div className="lg:col-span-5">
        <Terminal />
      </div>
    </div>
  </section>
);
