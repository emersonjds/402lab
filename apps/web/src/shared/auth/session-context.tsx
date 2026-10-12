'use client';

import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { apiRequest } from '@/shared/api/client';

type Session = {
  /** The signed-in human's address, or null when signed out. Display only — the
   * httpOnly cookie, not this value, authenticates every API request. */
  address: string | null;
  signIn: (address: string) => void;
  signOut: () => Promise<void>;
};

/** `skipHydration` keeps the first client render equal to the server's (signed out);
 * `QueryProvider` rehydrates from localStorage after mount. */
export const useSessionStore = create<Session>()(
  persist(
    (set) => ({
      address: null,
      signIn: (address) => {
        set({ address });
      },
      signOut: async () => {
        set({ address: null });
        await apiRequest('/auth/logout', { method: 'POST', schema: z.null() }).catch(() => {});
      },
    }),
    {
      name: '402lab.session.address',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ address: state.address }),
      skipHydration: true,
    },
  ),
);

export const useSession = (): Session => useSessionStore();
