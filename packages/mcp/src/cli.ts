#!/usr/bin/env node
import { homedir } from 'node:os';
import { join } from 'node:path';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createPayingFetch } from './paying-fetch.js';
import { createServer } from './server.js';
import { loadOrCreateSessionWallet } from './session-wallet.js';
import { createTools, readPerCallCap } from './tools.js';

const apiUrl = process.env['API_URL'] ?? 'http://localhost:8080';
const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000';
const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
const home = process.env['LAB402_HOME'] ?? join(homedir(), '.402lab');

const wallet = await loadOrCreateSessionWallet(home);

if (process.argv[2] === 'init') {
  console.log(`${wallet.created ? 'Created' : 'Reusing'} session wallet ${wallet.address}`);
  console.log(`Give it an allowance: ${webUrl}/app/allowances/new?session=${wallet.address}`);
} else {
  // stdout is the MCP channel; logs go to stderr.
  const source = { apiUrl, sessionAddress: wallet.address, plainFetch: fetch };
  const perCallCap = await readPerCallCap(source);
  const tools = createTools({
    ...source,
    rpcUrl,
    payingFetch: createPayingFetch(wallet.signer, perCallCap),
  });

  await createServer(tools).connect(new StdioServerTransport());
  console.error(`402lab-mcp ready: session ${wallet.address}, api ${apiUrl}`);
}
