import { TranslateTextCommand, type TranslateTextCommandOutput } from '@aws-sdk/client-translate';

import { type ServiceAdapter, UpstreamError } from './types.js';

export interface TranslateSender {
  send: (
    command: TranslateTextCommand,
  ) => Promise<Pick<TranslateTextCommandOutput, 'TranslatedText'>>;
}

export const createAwsTranslate =
  (client: TranslateSender): ServiceAdapter<'translate'> =>
  async ({ text, targetLanguage }) => {
    try {
      const { TranslatedText } = await client.send(
        new TranslateTextCommand({
          Text: text,
          SourceLanguageCode: 'auto',
          TargetLanguageCode: targetLanguage,
        }),
      );

      if (TranslatedText === undefined) {
        throw new Error('AWS Translate answered without text');
      }

      return { mode: 'live', result: TranslatedText };
    } catch (error) {
      throw new UpstreamError('aws-translate', { cause: error });
    }
  };
