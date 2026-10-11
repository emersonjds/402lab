import { getDefaultConfig } from 'expo/metro-config.js';

const projectRoot = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(/\/$/, '');
const config = getDefaultConfig(projectRoot);

type ResolveRequest = NonNullable<typeof config.resolver.resolveRequest>;

// Workspace packages are NodeNext TypeScript: relative imports end in `.js` while the files are `.ts`.
const resolveRequest: ResolveRequest = (context, moduleName, platform) => {
  const workspaceSource = !context.originModulePath.includes('node_modules');

  if (workspaceSource && moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    return context.resolveRequest(context, moduleName.slice(0, -'.js'.length), platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

// eslint-disable-next-line no-restricted-syntax -- metro reads this config as a default export
export default { ...config, resolver: { ...config.resolver, resolveRequest } };
