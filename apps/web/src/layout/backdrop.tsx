'use client';

import { useSidebar } from '@/context/sidebar-context';

export const Backdrop = () => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();

  if (!isMobileOpen) return null;

  return (
    <button
      type="button"
      aria-label="Close sidebar"
      onClick={toggleMobileSidebar}
      className="fixed inset-0 z-40 bg-gray-950/70 lg:hidden"
    />
  );
};
