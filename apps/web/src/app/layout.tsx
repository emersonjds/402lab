import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

import { SessionProvider } from '@/shared/auth/session-context';
import { MockBoundary } from '@/shared/mocks/mock-boundary';

import messages from '../messages/en.json';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

const title = '402Lab — Pocket money for AI agents';
const description =
  'Give your agent a budget. It pays any API per call in USDC on Solana — no cards, no signups, no surprise bills.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: title, template: '%s · 402Lab' },
  description,
  applicationName: '402Lab',
  openGraph: { type: 'website', siteName: '402Lab', title, description, url: '/' },
  twitter: { card: 'summary_large_image', title, description },
};

export const viewport: Viewport = { themeColor: '#0B0D10', colorScheme: 'dark' };

interface RootLayoutProps {
  children: ReactNode;
}

const RootLayout = ({ children }: RootLayoutProps) => (
  <html
    lang="en"
    // Dark is the only theme this product ships (DESIGN.md); light is reserved
    // for a future printable statement, so there is no runtime toggle yet.
    className={`dark ${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
  >
    <body>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-card focus:bg-raised focus:px-4 focus:py-3"
      >
        Skip to content
      </a>
      <NextIntlClientProvider locale="en" messages={messages}>
        <SessionProvider>
          <MockBoundary>{children}</MockBoundary>
        </SessionProvider>
      </NextIntlClientProvider>
    </body>
  </html>
);

// eslint-disable-next-line no-restricted-syntax -- next reads route files as default exports
export default RootLayout;
