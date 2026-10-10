import { z } from 'zod';

import { type ServiceAdapter, UpstreamError } from './types.js';

const ANALYZE_PATH = '/computervision/imageanalysis:analyze?features=read&api-version=2024-02-01';
const TIMEOUT_MILLISECONDS = 15_000;

const analysisSchema = z.object({
  readResult: z.object({
    blocks: z.array(z.object({ lines: z.array(z.object({ text: z.string() })) })),
  }),
});

export interface AzureOcrOptions {
  endpoint: string;
  key: string;
  fetchImplementation: typeof fetch;
}

export const createAzureOcr =
  ({ endpoint, key, fetchImplementation }: AzureOcrOptions): ServiceAdapter<'ocr'> =>
  async ({ imageUrl }) => {
    try {
      const response = await fetchImplementation(new URL(ANALYZE_PATH, endpoint).href, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'ocp-apim-subscription-key': key },
        body: JSON.stringify({ url: imageUrl }),
        signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS),
      });

      if (!response.ok) {
        throw new Error(`Azure answered ${String(response.status)}`);
      }

      const { readResult } = analysisSchema.parse(await response.json());

      return {
        mode: 'live',
        result: readResult.blocks.flatMap(({ lines }) => lines.map(({ text }) => text)).join('\n'),
      };
    } catch (error) {
      throw new UpstreamError('azure-ocr', { cause: error });
    }
  };
