import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { UnauthorizedError, type Connection } from '@/shared/api/client';

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

// Runs an authorized call: 401 forgets the pairing, any other failure flags the screen offline.
export const useConnection = () => {
  const { state, unpair } = useSession();
  const [offline, setOffline] = useState(false);
  const connection = state.status === 'paired' ? state.pairing : null;

  const run = useCallback(
    async (call: (connection: Connection) => Promise<void>): Promise<boolean> => {
      if (!connection) {
        return false;
      }

      try {
        await call(connection);
        setOffline(false);
        return true;
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          await unpair();
          return false;
        }

        setOffline(true);
        return false;
      }
    },
    [connection, unpair],
  );

  return { status: state.status, offline, run };
};
