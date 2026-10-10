import type { ServiceAdapters } from './types.js';

const SAMPLE_OCR_TEXT = 'RECEIPT #0042\nCoffee 2x $3.50\nTotal $7.00\nThank you!';

const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });

export const demoAdapters: ServiceAdapters = {
  ocr: () => Promise.resolve({ mode: 'demo', result: SAMPLE_OCR_TEXT }),
  translate: ({ text, targetLanguage }) =>
    Promise.resolve({ mode: 'demo', result: `[${targetLanguage}] ${text}` }),
  summarize: ({ text }) =>
    Promise.resolve({
      mode: 'demo',
      result: Array.from(sentences.segment(text), ({ segment }) => segment.trim())
        .slice(0, 3)
        .join(' '),
    }),
};
