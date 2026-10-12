import type { Provider } from '@402lab/shared';

import { BRAND_ICON_PATHS } from './brand-icons';

// Simple Icons slug for each catalog provider.
const PROVIDER_ICON: Record<Provider['id'], keyof typeof BRAND_ICON_PATHS> = {
  aws: 'amazonwebservices',
  azure: 'microsoftazure',
  'google-cloud': 'googlecloud',
  openai: 'openai',
  anthropic: 'anthropic',
  cloudflare: 'cloudflare',
  replicate: 'replicate',
  elevenlabs: 'elevenlabs',
  deepgram: 'deepgram',
};

export const ProviderIcon = ({ provider, size = 16 }: { provider: Provider; size?: number }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d={BRAND_ICON_PATHS[PROVIDER_ICON[provider.id]]} />
  </svg>
);
