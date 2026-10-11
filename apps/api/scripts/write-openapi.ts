import { writeFile } from 'node:fs/promises';

import { openApiDocument } from '../src/shared/openapi/document.js';

const CONTRACT_PATH = new URL('../openapi.json', import.meta.url);

const document = await openApiDocument();

await writeFile(CONTRACT_PATH, `${JSON.stringify(document, null, 2)}\n`);

process.stdout.write(`wrote ${CONTRACT_PATH.pathname}\n`);
