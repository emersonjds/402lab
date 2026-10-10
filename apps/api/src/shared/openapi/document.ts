import { generateKeyPairSync } from 'node:crypto';

import { createKeyPairSignerFromBytes } from '@solana/kit';

import { buildApp } from '../../app.js';
import type { OnrampChain } from '../../features/demo-onramp/routes.js';
import type { Config } from '../config/index.js';
import { createDatabase, createPool } from '../db/pool.js';
import { createEventsBus } from '../events-bus.js';

/** First 32 characters of the devnet genesis hash in `SOLANA_DEVNET` (@402lab/shared/network.ts),
 * duplicated here so the stub chain below satisfies `isDevnetGenesis` without a real RPC call. */
const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

/** solana-keygen's 64-byte format: a 32-byte seed followed by its 32-byte public key. */
const treasuryKeypairBytes = (): Uint8Array => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const jwk = privateKey.export({ format: 'jwk' });
  if (jwk.d === undefined || jwk.x === undefined) {
    throw new Error('ed25519 JWK export did not include the seed and the public key');
  }

  return Uint8Array.from([...Buffer.from(jwk.d, 'base64url'), ...Buffer.from(jwk.x, 'base64url')]);
};

/** Never called: assembling the document only reads route schemas, so the chain methods a live
 * on-ramp request would use exist here only to satisfy `buildApp`'s types. */
const unusedChainCall = (): Promise<never> =>
  Promise.reject(new Error('not called while generating the OpenAPI document'));

/**
 * The pool is never queried and the chain never dials out: assembling the document only reads
 * route schemas, so a database connection or a devnet RPC call would make generating the
 * contract depend on infrastructure it does not need. A disposable treasury key is generated so
 * the demo on-ramp route registers (and documents) the same way it would against a real devnet.
 */
export const openApiDocument = async (): Promise<unknown> => {
  const treasuryBytes = treasuryKeypairBytes();
  const treasury = await createKeyPairSignerFromBytes(treasuryBytes);
  const solanaChain: OnrampChain = {
    latestBlockhash: unusedChainCall,
    send: unusedChainCall,
    usdcBalance: unusedChainCall,
    genesisHash: () => Promise.resolve(DEVNET_GENESIS_HASH),
  };

  const config: Config = {
    PORT: 8080,
    LOG_LEVEL: 'fatal',
    FACILITATOR_URL: 'https://x402.org/facilitator',
    TREASURY_ADDRESS: treasury.address,
    PROVIDER_OCR_ADDRESS: treasury.address,
    PROVIDER_TRANSLATE_ADDRESS: treasury.address,
    PROVIDER_SUMMARIZE_ADDRESS: treasury.address,
    INTEGRATOR_ADDRESS: treasury.address,
    DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
    SOLANA_RPC_URL: 'https://api.devnet.solana.com',
    TREASURY_SECRET_KEY: JSON.stringify(Array.from(treasuryBytes)),
    SPLIT_WORKER_ENABLED: false,
    RECONCILIATION_ENABLED: false,
    NODE_ENV: 'production',
    TRUST_PROXY_HOPS: 0,
    JWT_SECRET: 'openapi-document-generation-placeholder-secret-value',
  };

  const app = await buildApp({
    config,
    database: createDatabase(createPool(config.DATABASE_URL)),
    bus: createEventsBus(),
    now: () => new Date(),
    solanaChain,
  });
  await app.ready();

  const document = app.swagger();
  await app.close();

  return document;
};
