// Sources in docs/research/02-saas-billing.md: Stripe 2.9% + $0.30 on $0.01; IOF per Decree 12,499/2025.
const STATS = [
  { value: '3,003%', label: 'card fee on a $0.01 API call' },
  { value: '3.5% IOF', label: 'on every international card purchase in Brazil' },
  { value: '$5 minimum', label: 'prepaid credits that expire in a year' },
] as const;

export const ProblemStats = () => (
  <section
    id="pricing"
    aria-labelledby="problem-title"
    className="scroll-mt-16 border-b border-line bg-surface/40"
  >
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <h2
        id="problem-title"
        className="font-mono text-xs font-semibold tracking-[0.2em] text-muted uppercase"
      >
        Why cards fail tiny payments
      </h2>
      <dl className="mt-8 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-3">
        {STATS.map(({ value, label }) => (
          <div key={value} className="flex flex-col-reverse gap-2 bg-bg p-6 sm:p-8">
            <dt className="text-muted">{label}</dt>
            <dd className="font-display text-4xl font-bold tracking-tight text-amber tabular-nums sm:text-5xl">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  </section>
);
