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
  { kind: 'path', slug: 'googletranslate', left: '4.5%', top: '76%', size: 47, className: BRAND },
  { kind: 'path', slug: 'replicate', left: '46.2%', top: '22.9%', size: 46, className: BRAND },
  { kind: 'path', slug: 'nvidia', left: '71.4%', top: '12.3%', size: 50, className: BRAND },
  { kind: 'path', slug: 'bnbchain', left: '17.4%', top: '35.9%', size: 41, className: COIN_CYAN },
  { kind: 'glyph', Icon: Spline, left: '92.0%', top: '67.1%', size: 29, className: GLYPH },
  { kind: 'glyph', Icon: Video, left: '94%', top: '53.9%', size: 26, className: GLYPH },
  { kind: 'path', slug: 'twilio', left: '17.4%', top: '64.3%', size: 50, className: BRAND },
  { kind: 'path', slug: 'solana', left: '86.3%', top: '2.4%', size: 36, className: COIN_CYAN },
  { kind: 'path', slug: 'dogecoin', left: '5.2%', top: '4.2%', size: 46, className: COIN_LIME },
  { kind: 'glyph', Icon: Map, left: '94%', top: '35.5%', size: 26, className: GLYPH },
  { kind: 'glyph', Icon: ImageIcon, left: '86.4%', top: '21.7%', size: 30, className: GLYPH },
  { kind: 'path', slug: 'deepl', left: '74.8%', top: '65.9%', size: 52, className: BRAND },
  { kind: 'glyph', Icon: Music, left: '3.9%', top: '23.0%', size: 31, className: GLYPH },
  { kind: 'path', slug: 'elevenlabs', left: '94%', top: '25.0%', size: 44, className: BRAND },
  { kind: 'glyph', Icon: MessageSquare, left: '73.5%', top: '75.0%', size: 28, className: GLYPH },
  { kind: 'path', slug: 'cardano', left: '94%', top: '12.1%', size: 34, className: COIN_CYAN },
  { kind: 'path', slug: 'polkadot', left: '14.6%', top: '4.5%', size: 36, className: COIN_LIME },
  { kind: 'path', slug: 'tether', left: '47.4%', top: '5.4%', size: 38, className: COIN_LIME },
  { kind: 'glyph', Icon: Code, left: '86.1%', top: '34.1%', size: 28, className: GLYPH },
  { kind: 'path', slug: 'cloudflare', left: '25.1%', top: '76%', size: 46, className: BRAND },
  { kind: 'path', slug: 'litecoin', left: '24.3%', top: '11.5%', size: 43, className: COIN_CYAN },
  { kind: 'usdc', left: '5.0%', top: '42.6%', size: 44, className: COIN_USDC },
  { kind: 'path', slug: 'microsoftazure', left: '94%', top: '44.9%', size: 41, className: BRAND },
  { kind: 'path', slug: 'openai', left: '83.9%', top: '11.4%', size: 51, className: BRAND },
  { kind: 'path', slug: 'spotify', left: '36.8%', top: '11.3%', size: 51, className: BRAND },
  { kind: 'glyph', Icon: CloudSun, left: '74.2%', top: '2%', size: 30, className: GLYPH },
  { kind: 'path', slug: 'anthropic', left: '27.1%', top: '2%', size: 50, className: BRAND },
  { kind: 'path', slug: 'github', left: '70.8%', top: '36.0%', size: 53, className: BRAND },
  { kind: 'path', slug: 'stellar', left: '84.6%', top: '45.5%', size: 44, className: COIN_CYAN },
  { kind: 'glyph', Icon: Languages, left: '38.1%', top: '24.5%', size: 31, className: GLYPH },
  { kind: 'path', slug: 'deepgram', left: '61.7%', top: '2%', size: 48, className: BRAND },
  { kind: 'path', slug: 'huggingface', left: '15.1%', top: '76.0%', size: 47, className: BRAND },
  { kind: 'path', slug: 'bitcoin', left: '49.6%', top: '76%', size: 46, className: COIN_LIME },
  { kind: 'path', slug: 'newyorktimes', left: '26.4%', top: '23.7%', size: 40, className: BRAND },
  { kind: 'path', slug: 'chainlink', left: '72.0%', top: '25.6%', size: 36, className: COIN_CYAN },
  { kind: 'path', slug: 'ethereum', left: '93.6%', top: '2%', size: 45, className: COIN_CYAN },
  { kind: 'path', slug: 'youtube', left: '15.0%', top: '56.3%', size: 42, className: BRAND },
  { kind: 'path', slug: 'wikipedia', left: '40.1%', top: '3.9%', size: 47, className: BRAND },
  { kind: 'path', slug: 'xrp', left: '94%', top: '75.6%', size: 41, className: COIN_LIME },
  { kind: 'glyph', Icon: Database, left: '3.7%', top: '65.9%', size: 30, className: GLYPH },
  { kind: 'glyph', Icon: ScanText, left: '82.5%', top: '75.4%', size: 28, className: GLYPH },
  { kind: 'path', slug: 'googlecloud', left: '27.9%', top: '31.9%', size: 47, className: BRAND },
  { kind: 'path', slug: 'unsplash', left: '2%', top: '14.7%', size: 53, className: BRAND },
  { kind: 'path', slug: 'mistralai', left: '38.6%', top: '76%', size: 46, className: BRAND },
  { kind: 'path', slug: 'polygon', left: '23.4%', top: '65.1%', size: 35, className: COIN_LIME },
  { kind: 'path', slug: 'mapbox', left: '86.1%', top: '64.9%', size: 50, className: BRAND },
  { kind: 'glyph', Icon: Search, left: '69.6%', top: '45.8%', size: 28, className: GLYPH },
  { kind: 'glyph', Icon: AudioLines, left: '2%', top: '32.7%', size: 28, className: GLYPH },
  { kind: 'glyph', Icon: Newspaper, left: '16.4%', top: '13.6%', size: 30, className: GLYPH },
  { kind: 'path', slug: 'openstreetmap', left: '50.6%', top: '13.6%', size: 49, className: BRAND },
  { kind: 'path', slug: 'googlegemini', left: '70.6%', top: '54.6%', size: 49, className: BRAND },
  { kind: 'path', slug: 'shopify', left: '2.2%', top: '57.1%', size: 51, className: BRAND },
  { kind: 'path', slug: 'x', left: '23.6%', top: '55.2%', size: 42, className: BRAND },
  { kind: 'path', slug: 'perplexity', left: '14.0%', top: '24.8%', size: 46, className: BRAND },
  {
    kind: 'path',
    slug: 'amazonwebservices',
    left: '62.0%',
    top: '13.3%',
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
        Your agent pays OpenAI, Anthropic, AWS and more by the request — in USDC, on Solana, inside
        the allowance you set.
      </p>
    </div>
  </div>
);
