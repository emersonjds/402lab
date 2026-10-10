import type { ReactNode } from 'react';

import { Button } from '@/shared/ui/button';
import { DevnetBadge } from '@/shared/ui/devnet-badge';
import { Wordmark } from '@/shared/ui/wordmark';

import { AppNav } from './app-nav';

export const AppShell = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-dvh flex-col">
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Wordmark />
          <DevnetBadge />
        </div>
        {/* ponytail: placeholder until the wallet sign-in lands (LAB-7 part B). */}
        <Button variant="secondary" disabled>
          Connect wallet
        </Button>
      </div>
    </header>
    <div className="flex flex-1">
      <AppNav layout="sidebar" />
      <main id="main" className="min-w-0 flex-1 px-4 pt-6 pb-24 sm:px-6 lg:pb-10">
        {children}
      </main>
    </div>
    <AppNav layout="tabs" />
  </div>
);
