const apiUrl = process.env.API_URL ?? 'https://api-production-570e4.up.railway.app';
const webUrl = process.env.WEB_URL ?? 'https://web-production-1b5d1.up.railway.app';
const demoUrl = process.env.DEMO_URL ?? 'https://web-demo-production-0d9a.up.railway.app';

type Check = { name: string; run: () => Promise<boolean> };

const respondsWith =
  (expectedStatus: number, url: string, init?: RequestInit) => async (): Promise<boolean> => {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    return response.status === expectedStatus;
  };

const paywallAsksForPayment = async (): Promise<boolean> => {
  const response = await fetch(`${apiUrl}/svc/ocr`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(15_000),
  });
  return response.status === 402 && response.headers.has('payment-required');
};

const catalogIsListed = async (): Promise<boolean> => {
  const response = await fetch(`${apiUrl}/services`, { signal: AbortSignal.timeout(15_000) });
  const body: unknown = await response.json();
  return (
    response.ok &&
    typeof body === 'object' &&
    body !== null &&
    'services' in body &&
    Array.isArray(body.services) &&
    body.services.length > 0
  );
};

const checks: Check[] = [
  { name: 'api lists the service catalog', run: catalogIsListed },
  { name: 'api answers an unpaid call with HTTP 402', run: paywallAsksForPayment },
  { name: 'api serves the Swagger UI', run: respondsWith(200, `${apiUrl}/docs`) },
  { name: 'web serves the landing page', run: respondsWith(200, `${webUrl}/`) },
  { name: 'web serves the wallet sign-in', run: respondsWith(200, `${webUrl}/connect`) },
  { name: 'web proxies /api to the api', run: respondsWith(200, `${webUrl}/api/services`) },
  { name: 'demo serves the panel', run: respondsWith(200, `${demoUrl}/app`) },
  {
    name: 'demo serves the mock worker',
    run: respondsWith(200, `${demoUrl}/mockServiceWorker.js`),
  },
];

const results = await Promise.all(
  checks.map(async ({ name, run }) => ({ name, passed: await run().catch(() => false) })),
);

for (const { name, passed } of results) {
  process.stdout.write(`${passed ? 'ok  ' : 'FAIL'} ${name}\n`);
}

if (results.some(({ passed }) => !passed)) {
  process.exit(1);
}
