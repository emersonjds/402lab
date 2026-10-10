const SNIPPET = `import { paymentMiddleware } from '@x402/fastify';

paymentMiddleware(app, {
  'POST /translate': {
    accepts: [{
      scheme: 'exact',
      price: '$0.002',
      network: SOLANA_DEVNET,
      payTo: PROVIDER_WALLET,
    }],
  },
}, resourceServer);

app.post('/translate', async (request) =>
  translate(request.body));`;

export const ForProviders = () => (
  <section aria-labelledby="providers-title" className="border-b border-line bg-surface/40">
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1.3fr] lg:items-center">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.2em] text-cyan uppercase">
          For API providers
        </p>
        <h2
          id="providers-title"
          className="mt-4 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl"
        >
          Answer 402 with a price. Get paid per call.
        </h2>
      </div>
      <figure className="min-w-0 overflow-hidden rounded-card border border-line bg-bg">
        <figcaption className="border-b border-line px-4 py-3 font-mono text-xs text-muted">
          routes.ts · Fastify
        </figcaption>
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-text sm:p-6 sm:text-sm">
          <code>{SNIPPET}</code>
        </pre>
      </figure>
    </div>
  </section>
);
