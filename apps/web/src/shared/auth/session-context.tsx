'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { z } from 'zod';

import { apiRequest } from '@/shared/api/client';

const STORAGE_KEY = '402lab.session.address';

type Session = {
  /** The signed-in human's address, or null when signed out. Display only — the
   * httpOnly cookie, not this value, authenticates every API request. */
  address: string | null;
  signIn: (address: string) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

const NOOP_SUBSCRIBE = () => () => {};

const readStoredAddress = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing or blocked storage: stay signed out.
    return null;
  }
};

const getServerAddress = (): string | null => null;

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  // Reads localStorage without a hydration mismatch: the server snapshot is
  // always null, the client snapshot is read once the DOM is interactive.
  const stored = useSyncExternalStore(NOOP_SUBSCRIBE, readStoredAddress, getServerAddress);
  const [override, setOverride] = useState<string | null | undefined>(undefined);
  const address = override === undefined ? stored : override;

  const signIn = useCallback((value: string) => {
    setOverride(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Best effort only; the session cookie still carries the real auth.
    }
  }, []);

  const signOut = useCallback(async () => {
    setOverride(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore: the cookie clear below is what actually matters.
    }
    await apiRequest('/auth/logout', { method: 'POST', schema: z.null() }).catch(() => {});
  }, []);

  return (
    <SessionContext.Provider value={{ address, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
};

/** Safe to call outside a provider: returns a signed-out, no-op session. */
export const useSession = (): Session => {
  const context = useContext(SessionContext);

  return (
    context ?? {
      address: null,
      signIn: () => {},
      signOut: async () => {},
    }
  );
};
