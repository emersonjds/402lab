import { generateKeyPairSync } from 'node:crypto';
import { createServer, type Server } from 'node:http';

import { USDC_DEVNET_MINT } from '@402lab/shared';
import {
  address,
  blockhash,
  generateKeyPairSigner,
  getAddressDecoder,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
} from '@solana/kit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildSplitTransaction } from '../src/features/splits/transaction.js';
import { createSolanaChain } from '../src/shared/solana/rpc.js';
import { loadTreasurySigner } from '../src/shared/solana/treasury.js';

const solanaKeypair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const jwk = z
    .object({ d: z.string(), x: z.string() })
    .parse({ ...privateKey.export({ format: 'jwk' }), ...publicKey.export({ format: 'jwk' }) });
  const publicBytes = Buffer.from(jwk.x, 'base64url');

  return {
    secretKeyJson: JSON.stringify([...Buffer.from(jwk.d, 'base64url'), ...publicBytes]),
    address: getAddressDecoder().decode(publicBytes),
  };
};

describe('loadTreasurySigner', () => {
  it('loads the signer of a 64-byte solana-keygen secret key', async () => {
    const keypair = solanaKeypair();

    const signer = await loadTreasurySigner(keypair.secretKeyJson, keypair.address);

    expect(signer.address).toBe(keypair.address);
  });

  it('refuses a key that is not the treasury address', async () => {
    const keypair = solanaKeypair();

    await expect(
      loadTreasurySigner(keypair.secretKeyJson, solanaKeypair().address),
    ).rejects.toThrow('TREASURY_SECRET_KEY does not belong to TREASURY_ADDRESS');
  });

  it.each([
    ['not JSON', '[12,34,secret'],
    ['the wrong length', JSON.stringify([1, 2, 3])],
    ['bytes out of range', JSON.stringify(Array.from({ length: 64 }, () => 256))],
  ])('refuses %s without echoing the key', async (_, secretKeyJson) => {
    const failure = loadTreasurySigner(secretKeyJson, solanaKeypair().address);

    await expect(failure).rejects.toThrow('TREASURY_SECRET_KEY must be a JSON array of 64 bytes');
    await expect(failure).rejects.not.toThrow('secret');
  });
});

const someSignature = getBase58Decoder().decode(new Uint8Array(64).fill(7));

type RpcCall = { method: string; params: unknown[] };

const rpcRequestSchema = z.object({
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.array(z.unknown()).default([]),
});

describe('createSolanaChain', () => {
  const calls: RpcCall[] = [];
  let statusValue: unknown = null;
  let hanging = false;
  let server: Server;
  let rpcUrl: string;

  const resultFor = (method: string): unknown => {
    switch (method) {
      case 'getLatestBlockhash':
        return {
          context: { slot: 1 },
          value: {
            blockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
            lastValidBlockHeight: 4_200,
          },
        };
      case 'getBlockHeight':
        return 4_100;
      case 'getSignatureStatuses':
        return { context: { slot: 1 }, value: [statusValue] };
      default:
        return 'sent-signature';
    }
  };

  beforeAll(async () => {
    server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      request.on('end', () => {
        const { id, method, params } = rpcRequestSchema.parse(JSON.parse(body));
        calls.push({ method, params });
        if (hanging) return;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ jsonrpc: '2.0', id, result: resultFor(method) }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    rpcUrl = `http://127.0.0.1:${String(z.object({ port: z.number() }).parse(server.address()).port)}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it('reads the latest blockhash and the block height as bigints', async () => {
    const chain = createSolanaChain(rpcUrl);

    await expect(chain.latestBlockhash()).resolves.toEqual({
      blockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
      lastValidBlockHeight: 4_200n,
    });
    await expect(chain.blockHeight()).resolves.toBe(4_100n);
    expect(calls.slice(-2)).toEqual([
      { method: 'getLatestBlockhash', params: [{ commitment: 'confirmed' }] },
      { method: 'getBlockHeight', params: [{ commitment: 'confirmed' }] },
    ]);
  });

  it('sends the signed wire transaction in base64', async () => {
    const treasury = await generateKeyPairSigner();
    const { signedTransaction } = await buildSplitTransaction({
      treasury,
      payouts: [
        { recipient: (await generateKeyPairSigner()).address, role: 'provider', amount: 1n },
      ],
      mint: address(USDC_DEVNET_MINT),
      latestBlockhash: {
        blockhash: blockhash('EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N'),
        lastValidBlockHeight: 4_200n,
      },
    });

    await createSolanaChain(rpcUrl).send(signedTransaction);

    expect(calls.at(-1)).toEqual({
      method: 'sendTransaction',
      params: [
        getBase64EncodedWireTransaction(signedTransaction),
        { encoding: 'base64', preflightCommitment: 'confirmed', skipPreflight: false },
      ],
    });
  });

  it.each([
    ['unknown', null],
    ['unknown', { slot: 1, confirmations: 0, err: null, confirmationStatus: 'processed' }],
    ['unknown', { slot: 1, confirmations: 0, err: { custom: 1 }, confirmationStatus: 'processed' }],
    ['confirmed', { slot: 1, confirmations: 1, err: null, confirmationStatus: 'confirmed' }],
    ['confirmed', { slot: 1, confirmations: null, err: null, confirmationStatus: 'finalized' }],
    ['failed', { slot: 1, confirmations: 1, err: { custom: 1 }, confirmationStatus: 'confirmed' }],
  ])('answers %s for status %j, searching the whole history', async (expected, value) => {
    statusValue = value;

    await expect(createSolanaChain(rpcUrl).signatureStatus(someSignature)).resolves.toBe(expected);
    expect(calls.at(-1)).toEqual({
      method: 'getSignatureStatuses',
      params: [[someSignature], { searchTransactionHistory: true }],
    });
  });

  it('gives up on every call when the rpc does not answer in time', async () => {
    const chain = createSolanaChain(rpcUrl, 50);
    const treasury = await generateKeyPairSigner();
    const { signedTransaction } = await buildSplitTransaction({
      treasury,
      payouts: [],
      mint: address(USDC_DEVNET_MINT),
      latestBlockhash: {
        blockhash: blockhash('EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N'),
        lastValidBlockHeight: 4_200n,
      },
    });
    hanging = true;

    try {
      await expect(chain.latestBlockhash()).rejects.toThrow();
      await expect(chain.blockHeight()).rejects.toThrow();
      await expect(chain.signatureStatus(someSignature)).rejects.toThrow();
      await expect(chain.send(signedTransaction)).rejects.toThrow();
    } finally {
      hanging = false;
    }
  });
});
