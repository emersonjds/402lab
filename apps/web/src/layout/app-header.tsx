'use client';

import { Menu, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { DevnetBadge } from '@/components/ui/devnet-badge';
import { Wordmark } from '@/components/ui/wordmark';
import { useSidebar } from '@/context/sidebar-context';
import { useSession } from '@/shared/auth/session-context';

const shortAddress = (address: string): string => `${address.slice(0, 4)}…${address.slice(-4)}`;

export const AppHeader = () => {
  const t = useTranslations('header');
  const { toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { address, signOut } = useSession();
  const router = useRouter();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) toggleSidebar();
    else toggleMobileSidebar();
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/connect');
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          aria-label={t('toggleSidebar')}
          className="flex size-11 items-center justify-center rounded-[6px] border border-line text-muted hover:border-gray-400"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        <div className="lg:hidden">
          <Wordmark />
        </div>
        <DevnetBadge />
      </div>
      <div className="flex items-center gap-3">
        {address && (
          <span className="inline-flex min-h-11 items-center gap-1.5 rounded-[6px] border border-line bg-raised px-3 font-mono text-sm text-text">
            <Wallet aria-hidden="true" className="size-4 text-brand-500" />
            {shortAddress(address)}
          </span>
        )}
        <Button variant="secondary" onClick={() => void handleLogout()}>
          {t('logout')}
        </Button>
      </div>
    </header>
  );
};
