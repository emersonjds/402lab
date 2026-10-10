import type { LiveEvent } from '@402lab/shared';

type Listener = (event: LiveEvent) => void;

export type EventsBus = {
  publish: (ownerAddress: string | null, event: LiveEvent) => void;
  subscribe: (ownerAddress: string, listener: Listener) => () => void;
};

// ponytail: in-process only; one API instance. Swap for Postgres LISTEN/NOTIFY when it scales out.
export const createEventsBus = (): EventsBus => {
  const listenersByOwner = new Map<string, Set<Listener>>();

  return {
    publish: (ownerAddress, event) => {
      if (ownerAddress === null) return;
      listenersByOwner.get(ownerAddress)?.forEach((listener) => {
        try {
          listener(event);
        } catch {
          // A listener is one live stream; its failure is that stream's, never the publisher's.
        }
      });
    },
    subscribe: (ownerAddress, listener) => {
      const listeners = listenersByOwner.get(ownerAddress) ?? new Set<Listener>();
      listeners.add(listener);
      listenersByOwner.set(ownerAddress, listeners);

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) listenersByOwner.delete(ownerAddress);
      };
    },
  };
};
