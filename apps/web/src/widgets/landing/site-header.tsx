import { buttonStyles } from '@/shared/ui/button';
import { Wordmark } from '@/shared/ui/wordmark';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '/api/docs', label: 'Docs' },
] as const;

export const SiteHeader = () => (
  <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
      <Wordmark />
      <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                className="inline-flex min-h-11 items-center px-3 text-sm text-muted transition-colors hover:text-text"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
        <a href="#waitlist" className={`${buttonStyles()} px-4 text-sm`}>
          Join waitlist
        </a>
      </nav>
    </div>
  </header>
);
