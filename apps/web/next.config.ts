import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:8080';

const nextConfig: NextConfig = {
  transpilePackages: ['@402lab/shared'],
  // @402lab/shared imports `./money.js` (NodeNext); Turbopack has no extensionAlias, webpack does.
  webpack: (config: { resolve: { extensionAlias?: Record<string, string[]> } }) => {
    config.resolve.extensionAlias = { '.js': ['.ts', '.js'] };
    return config;
  },
  // Same-origin proxy: the API session cookie stays first-party.
  rewrites: () => Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/:path*` }]),
};

// eslint-disable-next-line no-restricted-syntax -- next reads this config as a default export
export default nextConfig;
