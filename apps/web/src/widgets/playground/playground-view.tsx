'use client';

import { cardCostEquivalent, formatUsd, parseAtomic, type ServiceId } from '@402lab/shared';
import type { KeyPairSigner } from '@solana/kit';
import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SolscanLink } from '@/components/ui/solscan-link';
import { catalogServiceListSchema, type CatalogService } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';
import { serviceLabel } from '@/shared/catalog/service-info';
import { shortAddress } from '@/shared/format/address';
import { createBrowserPayingFetch } from '@/shared/wallet/paying-fetch';
import { settlementSignatureOf } from '@/shared/wallet/payment-response';
import { useSessionUsdcBalance } from '@/shared/wallet/session-balance';
import { loadOrCreateSessionSigner } from '@/shared/wallet/session-signer';

const SAMPLE_IMAGE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Example.png/320px-Example.png';

const PIPELINE: { id: ServiceId; buildBody: (previousResult: string) => unknown }[] = [
  { id: 'ocr', buildBody: () => ({ imageUrl: SAMPLE_IMAGE_URL }) },
  { id: 'translate', buildBody: (text) => ({ text, targetLanguage: 'en' }) },
  { id: 'summarize', buildBody: (text) => ({ text }) },
];

type TimelineEvent =
  | { kind: 'request'; service: ServiceId }
  | { kind: 'paid'; service: ServiceId; amount: string; signature: string | null }
  | { kind: 'result'; service: ServiceId; text: string }
  | { kind: 'error'; service: ServiceId; message: string };

type TimelineEntry = TimelineEvent & { id: number };

const outputSchema = (data: unknown): string => {
  if (data && typeof data === 'object' && 'result' in data && typeof data.result === 'string') {
    return data.result;
  }
  return '';
};

export const PlaygroundView = () => {
  const [signer, setSigner] = useState<KeyPairSigner | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [running, setRunning] = useState(false);
  const catalogQuery = useApiQuery('/services', catalogServiceListSchema);
  const sessionBalance = useSessionUsdcBalance(signer?.address ?? '', timeline.length);

  useEffect(() => {
    void loadOrCreateSessionSigner().then(setSigner);
  }, []);

  const payingFetch = useMemo(() => (signer ? createBrowserPayingFetch(signer) : null), [signer]);
  const priceOf = (id: ServiceId): CatalogService | undefined =>
    catalogQuery.status === 'ready' ? catalogQuery.data.services.find((s) => s.id === id) : undefined;

  const push = (entry: TimelineEvent) => {
    setTimeline((previous) => [...previous, { ...entry, id: previous.length }]);
  };

  const runPipeline = async () => {
    if (!payingFetch) return;

    setTimeline([]);
    setRunning(true);
    let carry = '';

    for (const step of PIPELINE) {
      push({ kind: 'request', service: step.id });
      try {
        const response = await payingFetch(`/api/svc/${step.id}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(step.buildBody(carry)),
        });

        if (!response.ok) {
          push({ kind: 'error', service: step.id, message: `${serviceLabel(step.id)} call failed.` });
          break;
        }

        const price = priceOf(step.id)?.price ?? '0';
        push({
          kind: 'paid',
          service: step.id,
          amount: price,
          signature: settlementSignatureOf(response),
        });

        const body: unknown = await response.json();
        carry = outputSchema(body);
        push({ kind: 'result', service: step.id, text: carry || '(empty result)' });
      } catch {
        push({ kind: 'error', service: step.id, message: `${serviceLabel(step.id)} call failed.` });
        break;
      }
    }

    setRunning(false);
  };

  const paidEntries = timeline.filter((entry): entry is Extract<TimelineEntry, { kind: 'paid' }> =>
    entry.kind === 'paid',
  );
  const totalSpent = paidEntries.reduce((sum, entry) => sum + parseAtomic(entry.amount), 0n);
  const completed = !running && paidEntries.length === PIPELINE.length;

  return (
    <div>
      <h1 className="font-display text-title-sm font-bold tracking-tight text-text">
        Agent execution playground
      </h1>
      <p className="mt-1 text-sm text-muted">
        A browser session wallet runs OCR → Translate → Summarize, paying for each HTTP 402 call live.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="font-display font-semibold text-text">Session wallet</h2>
          <p className="mt-3 font-mono text-xs text-muted">
            {signer ? shortAddress(signer.address) : 'Preparing…'}
          </p>
          <p className="mt-1 text-xs text-muted">
            Balance: {sessionBalance === null ? '—' : formatUsd(sessionBalance)} USDC
          </p>

          <Button className="mt-5 w-full" disabled={!payingFetch || running} onClick={() => void runPipeline()}>
            {running ? 'Running…' : 'Run agent pipeline'}
          </Button>

          {completed && (
            <div className="mt-4">
              <Alert variant="success" title="Pipeline complete">
                Spent {formatUsd(totalSpent)} across {String(PIPELINE.length)} calls — a card swipe for
                the same work costs {formatUsd(cardCostEquivalent(totalSpent))}.
              </Alert>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display font-semibold text-text">Execution timeline</h2>

          {timeline.length === 0 ? (
            <p className="mt-6 text-sm text-muted">Run the pipeline to see each 402 → paid → result step.</p>
          ) : (
            <ol className="mt-4 grid gap-3">
              {timeline.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-line p-3">
                  {entry.kind === 'request' && (
                    <p className="font-mono text-xs text-warning-400">
                      → 402 Payment Required · {serviceLabel(entry.service)}
                    </p>
                  )}
                  {entry.kind === 'paid' && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-xs text-brand-400">
                        ✓ Paid {formatUsd(parseAtomic(entry.amount))} · {serviceLabel(entry.service)}
                      </p>
                      {entry.signature && <SolscanLink signature={entry.signature} />}
                    </div>
                  )}
                  {entry.kind === 'result' && (
                    <p className="mt-1 text-sm text-text">
                      <span className="text-blue-light-400">{serviceLabel(entry.service)} result:</span>{' '}
                      {entry.text}
                    </p>
                  )}
                  {entry.kind === 'error' && (
                    <p className="font-mono text-xs text-error-400">✕ {entry.message}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
};
