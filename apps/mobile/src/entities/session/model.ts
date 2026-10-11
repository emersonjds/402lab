import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import { z } from 'zod';

const STORAGE_KEY = '402lab.pairing';

const pairingSchema = z.object({
  api: z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, '')),
  token: z.string().min(1),
});

export type Pairing = z.output<typeof pairingSchema>;

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export const parsePairingCode = (raw: string): Pairing | null => {
  const result = pairingSchema.safeParse(parseJson(raw));
  return result.success ? result.data : null;
};

export const loadPairing = async (): Promise<Pairing | null> => {
  const raw = await getItemAsync(STORAGE_KEY);
  return raw === null ? null : parsePairingCode(raw);
};

export const savePairing = (pairing: Pairing): Promise<void> =>
  setItemAsync(STORAGE_KEY, JSON.stringify(pairing));

export const clearPairing = (): Promise<void> => deleteItemAsync(STORAGE_KEY);
