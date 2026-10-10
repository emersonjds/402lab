import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { clearPairing, loadPairing, savePairing, type Pairing } from './model';

export { parsePairingCode, type Pairing } from './model';

type SessionState =
  { status: 'loading' } | { status: 'unpaired' } | { status: 'paired'; pairing: Pairing };

type Session = {
  state: SessionState;
  pair: (pairing: Pairing) => Promise<void>;
  unpair: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    void loadPairing().then((pairing) => {
      setState(pairing ? { status: 'paired', pairing } : { status: 'unpaired' });
    });
  }, []);

  const pair = useCallback(async (pairing: Pairing) => {
    await savePairing(pairing);
    setState({ status: 'paired', pairing });
  }, []);

  const unpair = useCallback(async () => {
    await clearPairing();
    setState({ status: 'unpaired' });
  }, []);

  const session = useMemo(() => ({ state, pair, unpair }), [state, pair, unpair]);

  return <SessionContext value={session}>{children}</SessionContext>;
};

export const useSession = (): Session => {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error('useSession must be used inside SessionProvider');
  }

  return session;
};
