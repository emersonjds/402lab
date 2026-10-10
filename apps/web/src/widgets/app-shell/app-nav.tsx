'use client';

import { FlaskConical, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: '/app', label: 'Allowances', icon: Wallet },
  { href: '/playground', label: 'Playground', icon: FlaskConical },
];

const isCurrent = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);

const LAYOUTS = {
  sidebar: {
    label: 'App',
    nav: 'hidden w-60 shrink-0 border-r border-line p-4 lg:block',
    list: 'grid gap-1',
    link: 'flex min-h-11 items-center gap-3 rounded-card px-3 text-sm',
  },
  tabs: {
    label: 'App tabs',
    nav: 'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden',
    list: 'grid grid-flow-col auto-cols-fr',
    link: 'flex min-h-14 flex-col items-center justify-center gap-1 text-xs',
  },
} as const;

export const AppNav = ({ layout }: { layout: keyof typeof LAYOUTS }) => {
  const pathname = usePathname();
  const styles = LAYOUTS[layout];

  return (
    <nav aria-label={styles.label} className={styles.nav}>
      <ul className={styles.list}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const current = isCurrent(pathname, href);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={`${styles.link} transition-colors ${current ? 'bg-raised text-lime' : 'text-muted hover:text-text'}`}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
