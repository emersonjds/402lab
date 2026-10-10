import Link from 'next/link';

export const Wordmark = () => (
  <Link href="/" aria-label="402Lab home" className="inline-flex min-h-11 items-center gap-1.5">
    <span className="rounded-md border border-lime/60 px-1.5 py-0.5 font-mono text-sm font-semibold text-lime">
      402
    </span>
    <span className="font-display text-lg font-bold tracking-tight">Lab</span>
  </Link>
);
