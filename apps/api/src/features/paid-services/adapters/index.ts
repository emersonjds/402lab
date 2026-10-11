import type { ServiceId } from '@402lab/shared';
import { Anthropic } from '@anthropic-ai/sdk';
import { TranslateClient } from '@aws-sdk/client-translate';

import type { Config } from '../../../shared/config/index.js';
import { createAnthropicSummary } from './anthropic-summary.js';
import { createAwsTranslate } from './aws-translate.js';
import { createAzureOcr } from './azure-ocr.js';
import { demoAdapters } from './demo.js';
import type { ServiceAdapters, ServiceOutput } from './types.js';

const TIMEOUT_MILLISECONDS = 15_000;

/** The seven newest services only ship demo adapters so far — no live upstream wired yet. */
export const resolveModes = (config: Config): Record<ServiceId, ServiceOutput['mode']> => ({
  ocr: config.AZURE_VISION_ENDPOINT && config.AZURE_VISION_KEY ? 'live' : 'demo',
  translate: config.AWS_REGION && config.AWS_ACCESS_KEY_ID ? 'live' : 'demo',
  summarize: config.ANTHROPIC_API_KEY ? 'live' : 'demo',
  vision: 'demo',
  chat: 'demo',
  embed: 'demo',
  image: 'demo',
  speech: 'demo',
  transcribe: 'demo',
  bedrock: 'demo',
});

/** AWS reads its credentials through the SDK default chain; the config only says whether they exist. */
export const resolveAdapters = (
  config: Config,
  fetchImplementation: typeof fetch = fetch,
): ServiceAdapters => {
  const {
    AZURE_VISION_ENDPOINT: endpoint,
    AZURE_VISION_KEY: key,
    AWS_REGION: region,
    AWS_ACCESS_KEY_ID: accessKeyId,
    ANTHROPIC_API_KEY: apiKey,
  } = config;

  return {
    ocr:
      endpoint && key ? createAzureOcr({ endpoint, key, fetchImplementation }) : demoAdapters.ocr,
    translate:
      region && accessKeyId
        ? createAwsTranslate(
            new TranslateClient({
              region,
              requestHandler: { requestTimeout: TIMEOUT_MILLISECONDS },
            }),
          )
        : demoAdapters.translate,
    summarize: apiKey
      ? createAnthropicSummary(
          new Anthropic({ apiKey, timeout: TIMEOUT_MILLISECONDS, maxRetries: 1 }).messages,
        )
      : demoAdapters.summarize,
    vision: demoAdapters.vision,
    chat: demoAdapters.chat,
    embed: demoAdapters.embed,
    image: demoAdapters.image,
    speech: demoAdapters.speech,
    transcribe: demoAdapters.transcribe,
    bedrock: demoAdapters.bedrock,
  };
};
