'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { SidebarProvider, useSidebar } from '@/context/sidebar-context';
import { AppHeader } from '@/layout/app-header';
import { AppSidebar } from '@/layout/app-sidebar';
import { Backdrop } from '@/layout/backdrop';

/**
 * Every `/app/*` route needs a session. `GET /api/allowances` is the cheapest
 * authenticated probe already wired for this product — a 401 means the
 * httpOnly cookie is missing or expired, so we bounce to /connect. The shell
 * renders right away; the probe only redirects.
 */
const useRequireSession = (): void => {
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 8000);

    fetch('/api/allowances', { credentials: 'same-origin', signal: controller.signal })
      .then((response) => {
        if (response.status === 401) router.replace('/connect');
      })
      .catch(() => {
        // Network hiccup or timeout: keep the owner in, the page's own data
        // fetches surface the error with fixed copy.
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [router]);
};

const Content = ({ children }: { children: ReactNode }) => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const open = isExpanded || isHovered || isMobileOpen;

  return (
    <div
      className={`flex min-h-dvh flex-col transition-all duration-300 print:pl-0 ${open ? 'lg:pl-64' : 'lg:pl-20'}`}
    >
      <AppHeader />
      <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 print:p-0">
        {children}
      </main>
    </div>
  );
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  useRequireSession();

  return (
    <SidebarProvider>
      <div className="min-h-dvh bg-bg print:bg-white">
        <AppSidebar />
        <Backdrop />
        <Content>{children}</Content>
      </div>
    </SidebarProvider>
  );
};
