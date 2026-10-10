import { WaitlistForm } from '@/features/join-waitlist/waitlist-form';

export const WaitlistSection = () => (
  <section
    id="waitlist"
    aria-labelledby="waitlist-title"
    className="scroll-mt-16 border-b border-line"
  >
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 sm:py-28">
      <h2
        id="waitlist-title"
        className="font-display text-3xl font-bold tracking-tight sm:text-4xl"
      >
        Join the waitlist
      </h2>
      <div className="mt-8">
        <WaitlistForm />
      </div>
      <p className="mt-4 font-mono text-xs text-muted">Devnet demo. Mainnet after licensing.</p>
    </div>
  </section>
);
