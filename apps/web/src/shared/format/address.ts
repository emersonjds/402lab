/** `5seM…b7deCj` — the display form used anywhere a full base58 address would wrap or overflow. */
export const shortAddress = (address: string): string => `${address.slice(0, 4)}…${address.slice(-4)}`;
