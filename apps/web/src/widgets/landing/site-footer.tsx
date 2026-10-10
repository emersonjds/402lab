import { Wordmark } from '@/shared/ui/wordmark';

const LINKS = [{ href: '/api/docs', label: 'Docs' }] as const;

export const SiteFooter = () => (
  <footer className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <div className="flex flex-col gap-2">
      <Wordmark />
      <p className="text-sm text-muted">Built for Colosseum Crypto World&apos;s Fair · Solana</p>
    </div>
    <ul className="flex gap-2">
      {LINKS.map(({ href, label }) => (
        <li key={label}>
          <a
            href={href}
            className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-text"
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  </footer>
);
