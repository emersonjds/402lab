import { buildApp } from './app.js';
import { loadConfig } from './shared/config/index.js';

const config = loadConfig();
const app = await buildApp({ config });

await app.listen({ port: config.PORT, host: '0.0.0.0' });
