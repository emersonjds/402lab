import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadOrCreateSessionWallet } from '../src/session-wallet.js';

const temporaryHome = () => mkdtemp(join(tmpdir(), '402lab-'));

describe('loadOrCreateSessionWallet', () => {
  it('creates the wallet once, readable only by the owner, and reuses it after', async () => {
    const directory = join(await temporaryHome(), '.402lab');

    const first = await loadOrCreateSessionWallet(directory);
    const second = await loadOrCreateSessionWallet(directory);

    const file = join(directory, 'session.json');
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.address).toBe(first.address);
    expect(second.signer.address).toBe(first.address);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(file, 'utf8'))).toHaveLength(64);
  });

  it('rejects a session file that is not a 64-byte keypair', async () => {
    const directory = await temporaryHome();
    await writeFile(join(directory, 'session.json'), '[1,2,3]');

    await expect(loadOrCreateSessionWallet(directory)).rejects.toThrow();
  });
});
