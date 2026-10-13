import { WaitlistForm } from '@/features/join-waitlist/waitlist-form';

export const WaitlistSection = () => (
  <section id="waitlist" className="scroll-mt-16">
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <div className="rounded-2xl border border-line bg-surface p-8 text-center sm:p-12">
        <span className="font-mono text-xs font-semibold tracking-wider text-brand-400 uppercase">
          Limited Devnet Cohort
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
          Give your agents a spending account today.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          Try it on Solana devnet today, and join the waitlist to hear when mainnet opens.
        </p>
        <div className="mx-auto mt-8 max-w-md">
          <WaitlistForm />
        </div>
        <p className="mt-6 font-mono text-xs text-muted">
          Devnet sandbox live. Mainnet rollout scheduled post-audits. No seed phrase required.
        </p>
      </div>
    </div>
  </section>
);
