const LINKS = [
  { href: 'https://github.com', label: 'GitHub' },
  { href: 'https://x.com/402lab', label: 'X (@402lab)' },
  { href: '/api/docs', label: 'Docs' },
  { href: '#', label: 'Terms' },
  { href: '#', label: 'Status' },
] as const;

export const SiteFooter = () => (
  <footer className="border-t border-line bg-surface/40">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-text">Built for Colosseum Crypto World&apos;s Fair · Solana</span>
        <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
          <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-blue-light-400" />
          Solana Devnet · Slot #284,912,041 · 400ms TPS
        </span>
      </div>
      <ul className="flex flex-wrap items-center gap-4 font-mono text-sm text-muted">
        {LINKS.map(({ href, label }) => (
          <li key={label}>
            <a href={href} className="inline-flex min-h-11 items-center hover:text-text">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  </footer>
);
