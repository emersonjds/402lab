import type { LucideIcon } from 'lucide-react';
import {
  AudioLines,
  CloudSun,
  Code,
  Database,
  Image as ImageIcon,
  Languages,
  Map,
  MessageSquare,
  Music,
  Newspaper,
  ScanText,
  Search,
  Spline,
  Video,
} from 'lucide-react';
import type { CSSProperties } from 'react';

import { BRAND_ICON_PATHS } from '@/shared/ui/brand-icons';

type IconSlug = keyof typeof BRAND_ICON_PATHS;

type SceneItem = { left: string; top: string; size: number; className: string } & (
  { kind: 'path'; slug: IconSlug } | { kind: 'glyph'; Icon: LucideIcon } | { kind: 'usdc' }
);

const BRAND = 'text-text opacity-15';
const GLYPH = 'text-cyan opacity-45';
const COIN_CYAN = 'text-cyan opacity-60';
const COIN_LIME = 'text-lime opacity-55';
const COIN_USDC = 'opacity-70';

const ITEMS: SceneItem[] = [
  {
    kind: 'path',
    slug: 'googletranslate',
    left: '77.6%',
    top: '34.0%',
    size: 47,
    className: BRAND,
  },
  { kind: 'path', slug: 'replicate', left: '48.9%', top: '13.0%', size: 40, className: BRAND },
  { kind: 'path', slug: 'nvidia', left: '92.2%', top: '69.6%', size: 44, className: BRAND },
  { kind: 'path', slug: 'bnbchain', left: '87.8%', top: '19.7%', size: 36, className: COIN_CYAN },
  { kind: 'glyph', Icon: Spline, left: '73.7%', top: '24.1%', size: 26, className: GLYPH },
  { kind: 'glyph', Icon: Video, left: '36.4%', top: '77.3%', size: 23, className: GLYPH },
  { kind: 'path', slug: 'twilio', left: '88.7%', top: '89.6%', size: 44, className: BRAND },
  { kind: 'path', slug: 'solana', left: '59.3%', top: '31.4%', size: 32, className: COIN_CYAN },
  { kind: 'path', slug: 'dogecoin', left: '75.2%', top: '87.5%', size: 40, className: COIN_LIME },
  { kind: 'glyph', Icon: Map, left: '26.4%', top: '3.0%', size: 23, className: GLYPH },
  { kind: 'glyph', Icon: ImageIcon, left: '26.8%', top: '46.9%', size: 26, className: GLYPH },
  { kind: 'path', slug: 'deepl', left: '53.9%', top: '66.9%', size: 46, className: BRAND },
  { kind: 'glyph', Icon: Music, left: '37.5%', top: '3.3%', size: 27, className: GLYPH },
  { kind: 'path', slug: 'elevenlabs', left: '36.2%', top: '33.9%', size: 39, className: BRAND },
  { kind: 'glyph', Icon: MessageSquare, left: '22.3%', top: '68.0%', size: 25, className: GLYPH },
  { kind: 'path', slug: 'cardano', left: '58.3%', top: '76.1%', size: 30, className: COIN_CYAN },
  { kind: 'path', slug: 'polkadot', left: '77.0%', top: '10.8%', size: 32, className: COIN_LIME },
  { kind: 'path', slug: 'tether', left: '62.2%', top: '89.3%', size: 33, className: COIN_LIME },
  { kind: 'glyph', Icon: Code, left: '26.1%', top: '77.3%', size: 25, className: GLYPH },
  { kind: 'path', slug: 'cloudflare', left: '80.0%', top: '68.4%', size: 40, className: BRAND },
  { kind: 'path', slug: 'litecoin', left: '8.4%', top: '45.0%', size: 38, className: COIN_CYAN },
  { kind: 'usdc', left: '4.3%', top: '21.4%', size: 39, className: COIN_USDC },
  { kind: 'path', slug: 'microsoftazure', left: '73.5%', top: '75.8%', size: 36, className: BRAND },
  { kind: 'path', slug: 'openai', left: '13.2%', top: '8.6%', size: 45, className: BRAND },
  { kind: 'path', slug: 'spotify', left: '35.0%', top: '68.2%', size: 45, className: BRAND },
  { kind: 'glyph', Icon: CloudSun, left: '3.0%', top: '53.5%', size: 26, className: GLYPH },
  { kind: 'path', slug: 'anthropic', left: '67.7%', top: '3.5%', size: 44, className: BRAND },
  { kind: 'path', slug: 'github', left: '92.0%', top: '10.6%', size: 47, className: BRAND },
  { kind: 'path', slug: 'stellar', left: '54.2%', top: '4.3%', size: 39, className: COIN_CYAN },
  { kind: 'glyph', Icon: Languages, left: '45.9%', top: '75.0%', size: 27, className: GLYPH },
  { kind: 'path', slug: 'deepgram', left: '60.1%', top: '17.9%', size: 42, className: BRAND },
  { kind: 'path', slug: 'huggingface', left: '47.1%', top: '21.7%', size: 41, className: BRAND },
  { kind: 'path', slug: 'bitcoin', left: '28.4%', top: '58.9%', size: 40, className: COIN_LIME },
  { kind: 'path', slug: 'newyorktimes', left: '13.7%', top: '61.0%', size: 35, className: BRAND },
  { kind: 'path', slug: 'chainlink', left: '16.9%', top: '51.4%', size: 32, className: COIN_CYAN },
  { kind: 'path', slug: 'ethereum', left: '89.6%', top: '60.1%', size: 40, className: COIN_CYAN },
  { kind: 'path', slug: 'youtube', left: '74.9%', top: '51.3%', size: 37, className: BRAND },
  { kind: 'path', slug: 'wikipedia', left: '57.6%', top: '11.1%', size: 41, className: BRAND },
  { kind: 'path', slug: 'xrp', left: '70.8%', top: '41.3%', size: 36, className: COIN_LIME },
  { kind: 'glyph', Icon: Database, left: '3.0%', top: '36.3%', size: 26, className: GLYPH },
  { kind: 'glyph', Icon: ScanText, left: '92.4%', top: '49.0%', size: 25, className: GLYPH },
  { kind: 'path', slug: 'googlecloud', left: '88.4%', top: '34.1%', size: 41, className: BRAND },
  { kind: 'path', slug: 'unsplash', left: '90.7%', top: '79.3%', size: 47, className: BRAND },
  { kind: 'path', slug: 'mistralai', left: '4.5%', top: '4.7%', size: 40, className: BRAND },
  { kind: 'path', slug: 'polygon', left: '25.5%', top: '26.7%', size: 31, className: COIN_LIME },
  { kind: 'path', slug: 'mapbox', left: '87.8%', top: '2.3%', size: 44, className: BRAND },
  { kind: 'glyph', Icon: Search, left: '71.3%', top: '62.7%', size: 25, className: GLYPH },
  { kind: 'glyph', Icon: AudioLines, left: '9.4%', top: '70.9%', size: 25, className: GLYPH },
  { kind: 'glyph', Icon: Newspaper, left: '18.8%', top: '37.1%', size: 26, className: GLYPH },
  { kind: 'path', slug: 'openstreetmap', left: '11.9%', top: '30.6%', size: 43, className: BRAND },
  { kind: 'path', slug: 'googlegemini', left: '82.8%', top: '45.2%', size: 43, className: BRAND },
  { kind: 'path', slug: 'shopify', left: '79.8%', top: '60.8%', size: 45, className: BRAND },
  { kind: 'path', slug: 'x', left: '34.8%', top: '13.3%', size: 37, className: BRAND },
  { kind: 'path', slug: 'perplexity', left: '48.5%', top: '31.0%', size: 40, className: BRAND },
  {
    kind: 'path',
    slug: 'amazonwebservices',
    left: '19.1%',
    top: '16.0%',
    size: 53,
    className: BRAND,
  },
];

const FLOATS = ['animate-float-sm', 'animate-float-md', 'animate-float-lg'] as const;

const TICKER = ['openai.chat', 'nytimes.article', 'nvidia.inference'] as const;

const ItemGlyph = ({ item }: { item: SceneItem }) => {
  if (item.kind === 'path') {
    return (
      <svg viewBox="0 0 24 24" width={item.size} height={item.size} fill="currentColor">
        <path d={BRAND_ICON_PATHS[item.slug]} />
      </svg>
    );
  }
  if (item.kind === 'glyph') {
    return <item.Icon size={item.size} strokeWidth={1.5} />;
  }
  return (
    <span
      style={{ width: item.size, height: item.size }}
      className="flex items-center justify-center rounded-full bg-lime font-mono text-lg font-bold text-bg"
    >
      $
    </span>
  );
};

const TickerLine = ({ service }: { service: string }) => (
  <li className="h-5 leading-5 whitespace-nowrap">
    {service} → 402 → paid <span className="text-lime">✓</span>
  </li>
);

export const PayableServicesScene = () => (
  <div className="relative hidden w-1/2 overflow-hidden bg-gray-900 lg:flex">
    <div aria-hidden="true" className="bg-ledger-grid absolute inset-0 opacity-60" />
    <div aria-hidden="true" className="absolute inset-0">
      {ITEMS.map((item, index) => (
        <span
          key={`${item.left}-${item.top}`}
          style={
            {
              left: item.left,
              top: item.top,
              animationDelay: `-${(index * 1.3).toFixed(1)}s`,
            } satisfies CSSProperties
          }
          className={`absolute motion-reduce:animate-none ${FLOATS[index % FLOATS.length] ?? ''} ${item.className}`}
        >
          <ItemGlyph item={item} />
        </span>
      ))}
    </div>
    <div
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing for next/image to optimize */}
      <img src="/logo-flask.svg" alt="" width={120} height={120} />
      <div className="flex items-center gap-2">
        <span className="rounded-[8px] border border-brand-500/60 px-2 py-0.5 font-mono text-2xl font-semibold text-brand-500">
          402
        </span>
        <span className="font-display text-3xl font-bold tracking-tight text-text">Lab</span>
      </div>
      <div className="h-5 overflow-hidden font-mono text-xs text-muted">
        <ul className="animate-ticker motion-reduce:animate-none">
          {[...TICKER, TICKER[0]].map((service, index) => (
            <TickerLine key={`${service}-${String(index)}`} service={service} />
          ))}
        </ul>
      </div>
    </div>
    <div className="absolute bottom-10 left-10 max-w-sm">
      <p className="font-display text-2xl font-bold tracking-tight text-text">
        Every API call, metered and paid.
      </p>
      <p className="mt-2 text-sm text-muted">
        Your agent pays OpenAI, Anthropic, AWS and more by the request, in USDC on Solana, always
        inside the allowance you set.
      </p>
    </div>
  </div>
);
