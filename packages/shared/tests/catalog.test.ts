import { describe, expect, it } from 'vitest';

import { buildCatalog, serviceSchema } from '../src/catalog.js';
import { assertValidSplitRules } from '../src/split.js';

describe('catalog', () => {
  it('builds three services with valid splits and positive prices', () => {
    const catalog = buildCatalog({
      provider: { ocr: 'P1', translate: 'P2', summarize: 'P3' },
      integrator: 'I',
      platform: 'T',
    });
    expect(catalog.map((service) => service.id)).toEqual(['ocr', 'translate', 'summarize']);
    expect(catalog.map((service) => service.price)).toEqual([5_000n, 2_000n, 10_000n]);
    for (const service of catalog) {
      expect(() => {
        assertValidSplitRules(service.splits);
      }).not.toThrow();
    }
  });

  it('routes each provider share to its own recipient with 85/5/10 split', () => {
    const [ocr] = buildCatalog({
      provider: { ocr: 'P1', translate: 'P2', summarize: 'P3' },
      integrator: 'I',
      platform: 'T',
    });
    expect(ocr?.splits).toEqual([
      { recipient: 'P1', role: 'provider', bps: 8500 },
      { recipient: 'I', role: 'integrator', bps: 500 },
      { recipient: 'T', role: 'platform', bps: 1000 },
    ]);
  });

  it('parses a service from the wire with price as an atomic string', () => {
    const service = serviceSchema.parse({
      id: 'ocr',
      name: 'OCR',
      description: 'Extract text from an image.',
      upstream: 'azure-ocr',
      price: '5000',
      splits: [{ recipient: 'T', role: 'platform', bps: 10000 }],
    });
    expect(service.price).toBe(5_000n);
  });

  it('rejects a non-integer price or unknown service', () => {
    const wire = {
      id: 'ocr',
      name: 'OCR',
      description: 'Extract text from an image.',
      upstream: 'azure-ocr',
      price: '0.005',
      splits: [],
    };
    expect(serviceSchema.safeParse(wire).success).toBe(false);
    expect(serviceSchema.safeParse({ ...wire, price: '5000', id: 'video' }).success).toBe(false);
  });
});
