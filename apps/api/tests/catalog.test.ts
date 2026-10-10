import { buildCatalog } from '@402lab/shared';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { catalogRoutes } from '../src/features/catalog/routes.js';
import { serviceListResponseSchema } from '../src/features/catalog/schemas.js';
import { RECIPIENT_ENVIRONMENT, TREASURY_ADDRESS } from './support/environment.js';

const catalog = buildCatalog({
  provider: {
    ocr: RECIPIENT_ENVIRONMENT.PROVIDER_OCR_ADDRESS,
    translate: RECIPIENT_ENVIRONMENT.PROVIDER_TRANSLATE_ADDRESS,
    summarize: RECIPIENT_ENVIRONMENT.PROVIDER_SUMMARIZE_ADDRESS,
  },
  integrator: RECIPIENT_ENVIRONMENT.INTEGRATOR_ADDRESS,
  platform: TREASURY_ADDRESS,
});

describe('GET /services', () => {
  it('lists the 3 services with atomic prices, upstream and current mode', async () => {
    const app = Fastify();
    await app.register(catalogRoutes, {
      catalog,
      modes: { ocr: 'live', translate: 'demo', summarize: 'demo' },
    });

    const response = await app.inject({ method: 'GET', url: '/services' });

    expect(response.statusCode).toBe(200);
    expect(serviceListResponseSchema.parse(response.json())).toEqual({
      services: [
        {
          id: 'ocr',
          name: 'OCR',
          description: 'Extract text from an image.',
          upstream: 'azure-ocr',
          price: '5000',
          mode: 'live',
        },
        {
          id: 'translate',
          name: 'Translate',
          description: 'Translate text between languages.',
          upstream: 'aws-translate',
          price: '2000',
          mode: 'demo',
        },
        {
          id: 'summarize',
          name: 'Summarize',
          description: 'Summarize a long text.',
          upstream: 'anthropic-summary',
          price: '10000',
          mode: 'demo',
        },
      ],
    });
    await app.close();
  });
});
