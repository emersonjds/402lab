import type { ServiceId, Upstream } from '@402lab/shared';

export type ServiceInput = {
  ocr: { imageUrl: string };
  translate: { text: string; targetLanguage: string };
  summarize: { text: string };
  vision: { imageUrl: string };
  chat: { prompt: string };
  embed: { text: string };
  image: { prompt: string };
  speech: { text: string };
  transcribe: { audioUrl: string };
  bedrock: { prompt: string };
};

export type ServiceOutput = { mode: 'live' | 'demo'; result: string };

export type ServiceAdapter<Id extends ServiceId> = (
  input: ServiceInput[Id],
) => Promise<ServiceOutput>;

export type ServiceAdapters = { [Id in ServiceId]: ServiceAdapter<Id> };

/** Carries only the upstream name: the route never echoes upstream text to the payer. */
export class UpstreamError extends Error {
  override readonly name = 'UpstreamError';

  constructor(
    readonly upstream: Upstream,
    options?: ErrorOptions,
  ) {
    super(`${upstream} is unavailable`, options);
  }
}
