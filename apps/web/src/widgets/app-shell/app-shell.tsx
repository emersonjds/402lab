'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { SidebarProvider, useSidebar } from '@/context/sidebar-context';
import { AppHeader } from '@/layout/app-header';
import { AppSidebar } from '@/layout/app-sidebar';
import { Backdrop } from '@/layout/backdrop';

type SessionCheck = 'checking' | 'signed-in';

/**
 * Every `/app/*` route needs a session. `GET /api/allowances` is the cheapest
 * authenticated probe already wired for this product — a 401 means the
 * httpOnly cookie is missing or expired, so we bounce to /connect before any
 * dashboard content renders.
 */
const useRequireSession = (): SessionCheck => {
  const router = useRouter();
  const [check, setCheck] = useState<SessionCheck>('checking');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/allowances', { credentials: 'same-origin' })
      .then((response) => {
        if (cancelled) return;
        if (response.status === 401) {
          router.replace('/connect');
          return;
        }
        setCheck('signed-in');
      })
      .catch(() => {
        // Network hiccup: don't lock the owner out, let the page render and
        // its own data fetches surface the error with fixed copy.
        if (!cancelled) setCheck('signed-in');
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return check;
};

const Content = ({ children }: { children: ReactNode }) => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const open = isExpanded || isHovered || isMobileOpen;

  return (
    <div className={`flex min-h-dvh flex-col transition-all duration-300 ${open ? 'lg:pl-64' : 'lg:pl-20'}`}>
      <AppHeader />
      <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const check = useRequireSession();

  if (check === 'checking') {
    return <div className="min-h-dvh bg-bg" aria-busy="true" aria-label="Checking session" />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-dvh bg-bg">
        <AppSidebar />
        <Backdrop />
        <Content>{children}</Content>
      </div>
    </SidebarProvider>
  );
};
