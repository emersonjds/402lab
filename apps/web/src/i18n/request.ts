import { getRequestConfig } from 'next-intl/server';

// Single locale for the hackathon MVP: no routing, no [locale] segment.
// ponytail: add locale negotiation and src/messages/pt.json when a second language ships.
// eslint-disable-next-line no-restricted-syntax -- next-intl's plugin requires a default export
export default getRequestConfig(async () => ({
  locale: 'en',
  messages: (await import('../messages/en.json')).default,
}));
