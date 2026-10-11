import Link from 'next/link';

export const Wordmark = () => (
  <Link href="/" aria-label="402Lab home" className="inline-flex min-h-11 items-center gap-1.5">
    <span className="rounded-[6px] border border-brand-500/60 px-1.5 py-0.5 font-mono text-sm font-semibold text-brand-500">
      402
    </span>
    <span className="font-display text-lg font-bold tracking-tight text-text">Lab</span>
  </Link>
);
