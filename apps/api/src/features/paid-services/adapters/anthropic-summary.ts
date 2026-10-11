import type {
  Message,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/messages';

import { type ServiceAdapter, UpstreamError } from './types.js';

export interface MessageCreator {
  create: (body: MessageCreateParamsNonStreaming) => Promise<Pick<Message, 'content'>>;
}

export const createAnthropicSummary =
  (messages: MessageCreator): ServiceAdapter<'summarize'> =>
  async ({ text }) => {
    try {
      const { content } = await messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        system: 'Summarize the following text in 3 bullet points.',
        messages: [{ role: 'user', content: text }],
      });
      const result = content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('');

      if (result === '') {
        throw new Error('Anthropic answered without text');
      }

      return { mode: 'live', result };
    } catch (error) {
      throw new UpstreamError('anthropic-summary', { cause: error });
    }
  };
