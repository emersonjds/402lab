import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiUrl = process.env.API_URL ?? 'http://localhost:8080';
const withNextIntl = createNextIntlPlugin();
const require = createRequire(import.meta.url);
// `"./browser"` in msw's exports map is `{ "node": null }`; Node's own resolver (this file runs
// under Node) honors that too, so resolve the package root via the one subpath that IS exported.
const mswBrowserEntry = join(dirname(require.resolve('msw/package.json')), 'lib/browser/index.js');

type WebpackConfig = {
  resolve: { extensionAlias?: Record<string, string[]>; alias?: Record<string, string> };
};

const nextConfig: NextConfig = {
  // Docker image: .next/standalone mirrors the monorepo, server at apps/web/server.js.
  output: 'standalone',
  outputFileTracingRoot: join(dirname(fileURLToPath(import.meta.url)), '../..'),
  transpilePackages: ['@402lab/shared', '@402lab/mocks'],
  webpack: (config: WebpackConfig) => {
    // @402lab/shared imports `./money.js` (NodeNext); Turbopack has no extensionAlias, webpack does.
    config.resolve.extensionAlias = { '.js': ['.ts', '.js'] };
    // msw's package.json sets `"./browser": { "node": null }`; webpack's exports-field resolver
    // short-circuits on that even for the client compiler, so point straight at the file.
    config.resolve.alias = {
      ...config.resolve.alias,
      'msw/browser': mswBrowserEntry,
    };
    return config;
  },
  // Same-origin proxy: the API session cookie stays first-party. Rewrites are compiled into
  // the build manifest, so API_URL must be set at `next build` (Docker build arg).
  rewrites: () => Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/:path*` }]),
};

// eslint-disable-next-line no-restricted-syntax -- next reads this config as a default export
export default withNextIntl(nextConfig);
