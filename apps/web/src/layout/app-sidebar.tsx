'use client';

import {
  FileText,
  FlaskConical,
  LayoutDashboard,
  Split,
  Wallet,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Wordmark } from '@/components/ui/wordmark';
import { useSidebar } from '@/context/sidebar-context';

const NAV_ITEMS: ReadonlyArray<{ key: string; href: string; icon: LucideIcon }> = [
  { key: 'overview', href: '/app', icon: LayoutDashboard },
  { key: 'agents', href: '/app/agents', icon: Wallet },
  { key: 'payments', href: '/app/payments', icon: Receipt },
  { key: 'splits', href: '/app/splits', icon: Split },
  { key: 'statement', href: '/app/statement', icon: FileText },
  { key: 'playground', href: '/app/playground', icon: FlaskConical },
];

// '/app' is a leaf (Overview), not a shared prefix: every other route also starts with
// '/app/', so it only matches exactly, unlike the rest of the nav.
const isCurrent = (pathname: string, href: string): boolean =>
  href === '/app' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

export const AppSidebar = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const t = useTranslations('sidebar');
  const open = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      onMouseEnter={() => {
        if (!isExpanded) setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      className={`fixed top-0 left-0 z-50 flex h-full flex-col border-r border-line bg-surface px-4 transition-all duration-300 ease-in-out lg:translate-x-0 ${
        open ? 'w-64' : 'w-20'
      } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="flex h-16 items-center">{open && <Wordmark />}</div>
      <nav className="flex-1 overflow-y-auto py-4">
        <h2 className="mb-3 px-3 font-mono text-theme-xs uppercase tracking-wide text-muted">
          {open ? t('groups.menu') : '···'}
        </h2>
        <ul className="grid gap-1">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
            const current = isCurrent(pathname, href);

            return (
              <li key={key}>
                <Link
                  href={href}
                  className={`group menu-item ${current ? 'menu-item-active' : 'menu-item-inactive'} ${
                    open ? '' : 'justify-center'
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    className={`size-5 ${current ? 'menu-item-icon-active' : 'menu-item-icon-inactive'}`}
                    strokeWidth={1.75}
                  />
                  {open && <span>{t(`items.${key}`)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};
