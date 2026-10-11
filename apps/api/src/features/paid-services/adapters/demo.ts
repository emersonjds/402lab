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
  vision: () => Promise.resolve({ mode: 'demo', result: 'A golden retriever sitting on grass.' }),
  chat: ({ prompt }) =>
    Promise.resolve({ mode: 'demo', result: `Demo reply to: "${prompt.slice(0, 60)}"` }),
  embed: () => Promise.resolve({ mode: 'demo', result: '[0.013, -0.084, 0.251, …] (1536d)' }),
  image: () => Promise.resolve({ mode: 'demo', result: 'https://demo.402lab.dev/image/sample.png' }),
  speech: () => Promise.resolve({ mode: 'demo', result: 'https://demo.402lab.dev/speech/sample.mp3' }),
  transcribe: () => Promise.resolve({ mode: 'demo', result: 'This is a demo transcription.' }),
  bedrock: ({ prompt }) =>
    Promise.resolve({ mode: 'demo', result: `Demo completion for: "${prompt.slice(0, 60)}"` }),
};
