import type { TranslateTextCommand } from '@aws-sdk/client-translate';
import { describe, expect, it } from 'vitest';

import { createAnthropicSummary } from '../src/features/paid-services/adapters/anthropic-summary.js';
import { createAwsTranslate } from '../src/features/paid-services/adapters/aws-translate.js';
import { createAzureOcr } from '../src/features/paid-services/adapters/azure-ocr.js';
import { demoAdapters } from '../src/features/paid-services/adapters/demo.js';
import { resolveAdapters, resolveModes } from '../src/features/paid-services/adapters/index.js';
import { UpstreamError } from '../src/features/paid-services/adapters/types.js';
import { loadConfig } from '../src/shared/config/index.js';
import { RECIPIENT_ENVIRONMENT, UPSTREAM_ENVIRONMENT } from './support/environment.js';

const IMAGE_URL = 'https://images.example.com/receipt.png';
const ANALYZE_URL =
  'https://vision.example.com/computervision/imageanalysis:analyze?features=read&api-version=2024-02-01';

const fakeFetch = (respond: () => Response) => {
  const calls: { input: Parameters<typeof fetch>[0]; init: RequestInit | undefined }[] = [];
  const implementation: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return respond();
  };
  return { implementation, calls };
};

const readResult = (...lines: string[]) =>
  Response.json({ readResult: { blocks: [{ lines: lines.map((text) => ({ text })) }] } });

describe('azure ocr', () => {
  const ocrWith = (respond: () => Response) => {
    const fetchFake = fakeFetch(respond);
    const ocr = createAzureOcr({
      endpoint: 'https://vision.example.com/',
      key: 'azure-key',
      fetchImplementation: fetchFake.implementation,
    });
    return { ocr, calls: fetchFake.calls };
  };

  it('reads every line of the image through the Image Analysis Read API', async () => {
    const { ocr, calls } = ocrWith(() => readResult('INVOICE 42', 'Total $9.90'));

    await expect(ocr({ imageUrl: IMAGE_URL })).resolves.toEqual({
      mode: 'live',
      result: 'INVOICE 42\nTotal $9.90',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(ANALYZE_URL);
    expect(calls[0]?.init).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json', 'ocp-apim-subscription-key': 'azure-key' },
      body: JSON.stringify({ url: IMAGE_URL }),
    });
  });

  it.each([
    ['an error status', () => new Response('quota exceeded for key azure-key', { status: 429 })],
    ['an unexpected body', () => Response.json({ error: { message: 'bad image' } })],
    [
      'a network failure',
      () => {
        throw new TypeError('fetch failed');
      },
    ],
  ])('turns %s into an UpstreamError', async (_case, respond) => {
    const { ocr } = ocrWith(respond);

    await expect(ocr({ imageUrl: IMAGE_URL })).rejects.toThrow(UpstreamError);
    await expect(ocr({ imageUrl: IMAGE_URL })).rejects.not.toThrow(/quota|bad image|fetch/);
  });
});

describe('aws translate', () => {
  it('translates from an auto-detected language into the target language', async () => {
    const sent: TranslateTextCommand['input'][] = [];
    const translate = createAwsTranslate({
      send: async (command: TranslateTextCommand) => {
        sent.push(command.input);
        return { TranslatedText: 'Olá mundo' };
      },
    });

    await expect(translate({ text: 'Hello world', targetLanguage: 'pt' })).resolves.toEqual({
      mode: 'live',
      result: 'Olá mundo',
    });
    expect(sent).toEqual([
      { Text: 'Hello world', SourceLanguageCode: 'auto', TargetLanguageCode: 'pt' },
    ]);
  });

  it.each([
    [
      'a rejected call',
      async () => {
        throw new Error('UnsupportedLanguagePairException');
      },
    ],
    ['an empty answer', async () => ({ TranslatedText: undefined })],
  ])('turns %s into an UpstreamError', async (_case, send) => {
    const translate = createAwsTranslate({ send });

    await expect(translate({ text: 'Hello', targetLanguage: 'xx' })).rejects.toThrow(UpstreamError);
  });
});

describe('anthropic summary', () => {
  it('asks claude-haiku-4-5 for 3 bullet points of the text', async () => {
    const bodies: unknown[] = [];
    const summarize = createAnthropicSummary({
      create: async (body) => {
        bodies.push(body);
        return { content: [{ type: 'text', text: '- one\n- two\n- three', citations: null }] };
      },
    });

    await expect(summarize({ text: 'A long article.' })).resolves.toEqual({
      mode: 'live',
      result: '- one\n- two\n- three',
    });
    expect(bodies).toEqual([
      {
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        system: 'Summarize the following text in 3 bullet points.',
        messages: [{ role: 'user', content: 'A long article.' }],
      },
    ]);
  });

  it.each([
    [
      'a rejected call',
      async () => {
        throw new Error('overloaded_error');
      },
    ],
    [
      'an answer without text',
      async () => ({
        content: [{ type: 'thinking' as const, thinking: 'hmm', signature: 'opaque' }],
      }),
    ],
  ])('turns %s into an UpstreamError', async (_case, create) => {
    const summarize = createAnthropicSummary({ create });

    await expect(summarize({ text: 'A long article.' })).rejects.toThrow(UpstreamError);
  });
});

describe('demo adapters', () => {
  it('answers ocr with the same sample text whatever the image', async () => {
    const first = await demoAdapters.ocr({ imageUrl: IMAGE_URL });
    const second = await demoAdapters.ocr({ imageUrl: 'https://images.example.com/other.png' });

    expect(first.mode).toBe('demo');
    expect(first.result).not.toBe('');
    expect(second).toEqual(first);
  });

  it('prefixes the text with the target language', async () => {
    await expect(
      demoAdapters.translate({ text: 'Hello world', targetLanguage: 'pt' }),
    ).resolves.toEqual({ mode: 'demo', result: '[pt] Hello world' });
  });

  it.each([
    ['One. Two? Three! Four. Five.', 'One. Two? Three!'],
    ['A single sentence without a full stop', 'A single sentence without a full stop'],
  ])('summarizes %j as its first three sentences', async (text, result) => {
    await expect(demoAdapters.summarize({ text })).resolves.toEqual({ mode: 'demo', result });
  });
});

describe('resolveAdapters', () => {
  it('stays in demo mode for every service without upstream credentials', async () => {
    const config = loadConfig(RECIPIENT_ENVIRONMENT);
    const adapters = resolveAdapters(config);

    expect(resolveModes(config)).toEqual({ ocr: 'demo', translate: 'demo', summarize: 'demo' });
    await expect(
      adapters.translate({ text: 'Hello world', targetLanguage: 'pt' }),
    ).resolves.toEqual({ mode: 'demo', result: '[pt] Hello world' });
  });

  it('goes live for every service once all upstream credentials exist', async () => {
    const config = loadConfig({ ...RECIPIENT_ENVIRONMENT, ...UPSTREAM_ENVIRONMENT });
    const fetchFake = fakeFetch(() => readResult('live text'));
    const adapters = resolveAdapters(config, fetchFake.implementation);

    expect(resolveModes(config)).toEqual({ ocr: 'live', translate: 'live', summarize: 'live' });
    await expect(adapters.ocr({ imageUrl: IMAGE_URL })).resolves.toEqual({
      mode: 'live',
      result: 'live text',
    });
    expect(fetchFake.calls[0]?.input).toBe(ANALYZE_URL);
  });

  it.each([
    ['AZURE_VISION_KEY', { ocr: 'demo', translate: 'live', summarize: 'live' }],
    ['AZURE_VISION_ENDPOINT', { ocr: 'demo', translate: 'live', summarize: 'live' }],
    ['AWS_ACCESS_KEY_ID', { ocr: 'live', translate: 'demo', summarize: 'live' }],
    ['AWS_REGION', { ocr: 'live', translate: 'demo', summarize: 'live' }],
    ['ANTHROPIC_API_KEY', { ocr: 'live', translate: 'live', summarize: 'demo' }],
  ])('falls back to demo for the service missing %s', (missing, modes) => {
    const environment: Record<string, string> = {
      ...RECIPIENT_ENVIRONMENT,
      ...UPSTREAM_ENVIRONMENT,
      [missing]: '',
    };

    expect(resolveModes(loadConfig(environment))).toEqual(modes);
  });
});
