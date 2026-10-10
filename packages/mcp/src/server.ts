import { serviceIdSchema } from '@402lab/shared';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { Tools } from './tools.js';

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });

export const createServer = (tools: Tools): McpServer => {
  const server = new McpServer({ name: '402lab', version: '0.1.0' });

  server.registerTool(
    'list_services',
    {
      description: 'List the paid APIs on 402Lab with their price per call in USDC.',
    },
    async () => text(await tools.listServices()),
  );

  server.registerTool(
    'call_service',
    {
      description:
        'Call a 402Lab service and pay for it in USDC from the session wallet (within the allowance). ' +
        'Inputs: ocr { imageUrl } (http/https), translate { text, targetLanguage }, summarize { text }.',
      inputSchema: {
        serviceId: serviceIdSchema,
        input: z.record(z.string(), z.string()),
      },
    },
    async ({ serviceId, input }) => text(await tools.callService(serviceId, input)),
  );

  server.registerTool(
    'get_allowance',
    {
      description:
        'Show the allowance of this session wallet (status, caps, spent today) and its USDC balance.',
    },
    async () => text(await tools.getAllowance()),
  );

  return server;
};
