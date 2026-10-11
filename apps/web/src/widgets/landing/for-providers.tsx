import { CheckCircle2 } from 'lucide-react';

import { Card } from '@/components/ui/card';

const BENEFITS = [
  {
    title: 'Standard HTTP Protocol',
    body: 'Zero custom SDK required by clients. Uses standard RFC HTTP headers.',
  },
  {
    title: 'Sub-second Verification',
    body: 'Transactions are verified against Solana mempool in under 400ms before payload execution.',
  },
  {
    title: 'Zero Billing Infrastructure',
    body: 'Eliminates Stripe customer portals, dunning logic, and unpaid trial abuse.',
  },
] as const;

const SNIPPET = `from fastapi import FastAPI
from lab402 import require_payment

app = FastAPI()

@app.get("/svc/ocr")
@require_payment(
    price_usdc=0.005,
    recipient="402LabTreasury...b7x"
)
async def extract_text(image_url: str):
    # 1. 402 Payment Required returned automatically if unpaid
    # 2. Solana signature verified on-chain before handler runs
    # 3. Micro-payment settled directly into your treasury

    extracted_content = await ocr_engine.process(image_url)
    return {"status": "success", "text": extracted_content}`;

export const ForProviders = () => (
  <section className="border-b border-line bg-surface/40">
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:items-center">
      <div className="lg:col-span-5">
        <p className="font-mono text-xs font-semibold tracking-wider text-blue-light-400 uppercase">
          Developer Integration
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
          Answer 402 with a price.
          <br />
          Get paid per call.
        </h2>
        <p className="mt-4 leading-relaxed text-muted">
          Turn any FastAPI, Express, or Next.js route into a pay-per-call monetized API with one
          decorator or middleware. No merchant accounts, no chargebacks, and no KYC friction.
        </p>
        <ul className="mt-6 grid gap-3">
          {BENEFITS.map(({ title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-brand-400"
                strokeWidth={1.75}
              />
              <div>
                <p className="font-medium text-text">{title}</p>
                <p className="text-sm text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Card className="overflow-hidden lg:col-span-7">
        <div className="flex items-center justify-between border-b border-line bg-raised px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-error-500" />
            <span className="size-3 rounded-full bg-warning-400" />
            <span className="size-3 rounded-full bg-brand-500" />
            <span className="ml-2 font-mono text-xs text-muted">api_server.py</span>
          </div>
          <span className="font-mono text-xs text-blue-light-400">FastAPI + 402Lab Middleware</span>
        </div>
        <pre className="overflow-x-auto p-6 font-mono text-xs leading-relaxed text-muted sm:text-sm">
          <code>{SNIPPET}</code>
        </pre>
        <div className="flex items-center justify-between border-t border-line bg-raised px-6 py-3 font-mono text-xs text-muted">
          <span>Also supports: TypeScript, Go, Rust axum, and Next.js Edge</span>
          <span className="rounded-[6px] border border-line bg-surface px-2.5 py-1 text-text">
            pip install 402lab
          </span>
        </div>
      </Card>
    </div>
  </section>
);
