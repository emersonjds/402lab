import { buttonStyles } from '@/shared/ui/button';
import { DevnetBadge } from '@/shared/ui/devnet-badge';

type Tone = 'plain' | 'amber' | 'lime' | 'cyan';

const TONES: Record<Tone, string> = {
  plain: 'text-text',
  amber: 'text-amber',
  lime: 'text-lime',
  cyan: 'text-cyan',
};

const RUN: ReadonlyArray<ReadonlyArray<readonly [string, Tone]>> = [
  [
    ['GET /svc/ocr → ', 'plain'],
    ['402 Payment Required', 'amber'],
    [' ($0.005)', 'plain'],
  ],
  [
    ['paid 0.005 USDC · sig ', 'lime'],
    ['5Jt…xQ', 'cyan'],
    [' ✓ 412ms', 'lime'],
  ],
  [
    ['GET /svc/translate → ', 'plain'],
    ['402', 'amber'],
    [' ($0.002) → ', 'plain'],
    ['paid ✓', 'lime'],
  ],
  [
    ['GET /svc/summarize → ', 'plain'],
    ['402', 'amber'],
    [' ($0.010) → ', 'plain'],
    ['paid ✓', 'lime'],
  ],
  [
    ['total $0.017 · card + IOF would cost ', 'plain'],
    ['$0.95', 'amber'],
  ],
];

const LINE_DELAY_MS = 650;

const Terminal = () => (
  <figure
    aria-label="Example agent run"
    className="relative min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-lime)_14%,transparent),0_30px_80px_-40px_color-mix(in_oklab,var(--color-lime)_35%,transparent)]"
  >
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <div aria-hidden="true" className="flex gap-1.5">
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
      </div>
      <span className="font-mono text-xs text-muted">research-bot · allowance $1.00/day</span>
    </div>
    <ol className="grid gap-2.5 p-4 font-mono text-xs leading-relaxed sm:p-6 sm:text-sm">
      {RUN.map((segments, index) => (
        <li
          key={segments.map(([text]) => text).join('')}
          className="flex animate-type-in gap-2 break-words"
          style={{ animationDelay: `${String(300 + index * LINE_DELAY_MS)}ms` }}
        >
          <span aria-hidden="true" className="text-muted">
            &gt;
          </span>
          <span className="min-w-0">
            {segments.map(([text, tone]) => (
              <span key={text} className={TONES[tone]}>
                {text}
              </span>
            ))}
          </span>
        </li>
      ))}
      <li aria-hidden="true" className="flex gap-2">
        <span className="text-muted">&gt;</span>
        <span className="inline-block h-4 w-2 animate-blink bg-lime" />
      </li>
    </ol>
  </figure>
);

export const Hero = ({ demoUrl }: { demoUrl?: string | undefined }) => (
  <section className="relative isolate overflow-hidden border-b border-line">
    <div
      aria-hidden="true"
      className="bg-ledger-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_80%_70%_at_30%_20%,black,transparent)]"
    />
    <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pt-24 lg:pb-28">
      <div className="min-w-0">
        <DevnetBadge />
        <h1 className="mt-6 font-display text-5xl leading-[1.02] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
          Pocket money for <span className="text-lime">AI agents.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Give your agent a budget. It pays any API per call in USDC on Solana — no cards, no
          signups, no surprise bills.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#waitlist" className={buttonStyles()}>
            Join the waitlist
          </a>
          {demoUrl && (
            <a href={demoUrl} className={buttonStyles('secondary')}>
              Watch the 60s demo
            </a>
          )}
        </div>
      </div>
      <Terminal />
    </div>
  </section>
);
