import Link from 'next/link';

import { buttonStyles } from '@/components/ui/button';
import { DevnetBadge } from '@/components/ui/devnet-badge';
import { Wordmark } from '@/components/ui/wordmark';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '/api/docs', label: 'Docs' },
  { href: '#explorer', label: 'Solscan Proof' },
] as const;

export const SiteHeader = () => (
  <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Wordmark />
        <DevnetBadge />
      </div>
      <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
        {NAV_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className="inline-flex min-h-11 items-center px-3 text-sm text-muted transition-colors hover:text-text"
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Link
          href="/connect"
          className="hidden min-h-11 items-center px-3.5 font-mono text-sm text-muted transition-colors hover:text-text sm:inline-flex"
        >
          Launch Agent
        </Link>
        <a href="#waitlist" className={`${buttonStyles()} px-4 text-sm`}>
          Join waitlist
        </a>
      </div>
    </div>
  </header>
);
