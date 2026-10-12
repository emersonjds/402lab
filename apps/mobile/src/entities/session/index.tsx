import { create } from 'zustand';

import { clearPairing, loadPairing, savePairing, type Pairing } from './model';

export { parsePairingCode, type Pairing } from './model';

type SessionState =
  { status: 'loading' } | { status: 'unpaired' } | { status: 'paired'; pairing: Pairing };

type Session = {
  state: SessionState;
  pair: (pairing: Pairing) => Promise<void>;
  unpair: () => Promise<void>;
};

export const usePairingStore = create<Session>()((set) => ({
  state: { status: 'loading' },
  pair: async (pairing) => {
    await savePairing(pairing);
    set({ state: { status: 'paired', pairing } });
  },
  unpair: async () => {
    await clearPairing();
    set({ state: { status: 'unpaired' } });
  },
}));

export const hydratePairing = async (): Promise<void> => {
  const pairing = await loadPairing();
  usePairingStore.setState({
    state: pairing ? { status: 'paired', pairing } : { status: 'unpaired' },
  });
};

export const useSession = (): Session => usePairingStore();

export const useConnection = () => {
  const state = usePairingStore((session) => session.state);
  return { status: state.status, connection: state.status === 'paired' ? state.pairing : null };
};
