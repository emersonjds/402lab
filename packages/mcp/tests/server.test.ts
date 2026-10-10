import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';

import { createServer } from '../src/server.js';
import type { Tools } from '../src/tools.js';

describe('createServer', () => {
  it('exposes the three paying tools to an mcp client', async () => {
    const tools: Tools = {
      listServices: async () => 'services',
      callService: vi.fn<Tools['callService']>(async () => 'paid: $0.002'),
      getAllowance: async () => 'allowance',
    };
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await createServer(tools).connect(serverTransport);
    await client.connect(clientTransport);

    const { tools: listed } = await client.listTools();
    const call = await client.callTool({
      name: 'call_service',
      arguments: { serviceId: 'translate', input: { text: 'hi', targetLanguage: 'pt' } },
    });
    const services = await client.callTool({ name: 'list_services', arguments: {} });
    const allowance = await client.callTool({ name: 'get_allowance', arguments: {} });

    expect(listed.map((tool) => tool.name).sort()).toEqual([
      'call_service',
      'get_allowance',
      'list_services',
    ]);
    expect(call.content).toEqual([{ type: 'text', text: 'paid: $0.002' }]);
    expect(services.content).toEqual([{ type: 'text', text: 'services' }]);
    expect(allowance.content).toEqual([{ type: 'text', text: 'allowance' }]);
    expect(tools.callService).toHaveBeenCalledWith('translate', {
      text: 'hi',
      targetLanguage: 'pt',
    });
  });
});
