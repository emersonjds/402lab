import { buildCatalog, type Service, type ServiceId } from '@402lab/shared';

// Names, providers and split rules are the same for everyone; recipients are not needed here
// (same approach as apps/mobile/src/entities/payment).
const CATALOG: Service[] = buildCatalog({
  provider: {
    ocr: '',
    translate: '',
    summarize: '',
    vision: '',
    chat: '',
    embed: '',
    image: '',
    speech: '',
    transcribe: '',
    bedrock: '',
  },
  integrator: '',
  platform: '',
});

export const serviceInfo = (id: ServiceId): Service => {
  const found = CATALOG.find((service) => service.id === id);
  if (!found) throw new Error(`unknown service "${id}"`);
  return found;
};

export const serviceLabel = (id: ServiceId): string => {
  const service = serviceInfo(id);
  return `${service.name} · ${service.provider.name}`;
};

export const PROVIDERS = [...new Map(CATALOG.map((service) => [service.provider.id, service.provider])).values()];
