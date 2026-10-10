import { describe, expect, it } from 'vitest';

import { explorerTxUrl } from '../src/network.js';

describe('network', () => {
  it('links a transaction to the devnet explorer', () => {
    expect(explorerTxUrl('5abc')).toBe('https://solscan.io/tx/5abc?cluster=devnet');
  });
});
