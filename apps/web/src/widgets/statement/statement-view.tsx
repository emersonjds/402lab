'use client';

import { formatUsd, parseAtomic } from '@402lab/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SolscanLink } from '@/components/ui/solscan-link';
import { allowanceListSchema, statementSchema } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';
import { shortAddress } from '@/shared/format/address';

const SERVICE_LABEL = { ocr: 'OCR', translate: 'Translate', summarize: 'Summarize' } as const;
const ROLE_LABEL = { provider: 'Provider', integrator: 'Integrator', platform: 'Platform' } as const;

const currentMonth = (): string => new Date().toISOString().slice(0, 7);

export const StatementView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const allowancesQuery = useApiQuery('/allowances', allowanceListSchema);

  const allowances = allowancesQuery.status === 'ready' ? allowancesQuery.data.allowances : [];
  const firstAllowanceId = allowances[0]?.id ?? null;
  const allowanceId = searchParams.get('allowance') ?? firstAllowanceId;
  const month = searchParams.get('month') ?? currentMonth();

  useEffect(() => {
    if (searchParams.get('allowance') || !firstAllowanceId) return;

    const params = new URLSearchParams(searchParams);
    params.set('allowance', firstAllowanceId);
    if (!params.get('month')) params.set('month', currentMonth());
    router.replace(`${pathname}?${params.toString()}`);
  }, [firstAllowanceId, pathname, router, searchParams]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const statementPath = allowanceId ? `/allowances/${allowanceId}/statement?month=${month}` : null;
  const statementQuery = useApiQuery(statementPath, statementSchema);
  const allowanceName = allowances.find((allowance) => allowance.id === allowanceId)?.agentName ?? '';

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display text-title-sm font-bold tracking-tight text-text">Statement</h1>
          <p className="mt-1 text-sm text-muted">Monthly spend by agent, with the card-cost comparison.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            window.print();
          }}
        >
          Print / Save PDF
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 print:hidden">
        <div>
          <Label htmlFor="statementAllowance">Agent</Label>
          <Select
            id="statementAllowance"
            value={allowanceId ?? ''}
            onChange={(event) => {
              updateParam('allowance', event.target.value);
            }}
          >
            {allowances.map((allowance) => (
              <option key={allowance.id} value={allowance.id}>
                {allowance.agentName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="statementMonth">Month</Label>
          <input
            id="statementMonth"
            type="month"
            value={month}
            onChange={(event) => {
              updateParam('month', event.target.value);
            }}
            className="h-11 w-full rounded-lg border border-line bg-raised px-4 text-base text-text focus:border-brand-400 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden"
          />
        </div>
      </div>

      {allowancesQuery.status === 'error' && (
        <Alert variant="error" title="Couldn't load allowances">
          {allowancesQuery.message}
        </Alert>
      )}

      {statementQuery.status === 'error' && (
        <Alert variant="error" title="Couldn't load the statement">
          {statementQuery.message}
        </Alert>
      )}

      {statementQuery.status === 'ready' && (
        <div className="mt-6 grid gap-6 rounded-xl border border-line bg-surface p-6 print:border-0 print:bg-white print:p-0 print:text-black">
          <h2 className="font-display text-lg font-bold text-text print:text-black">
            {allowanceName} · {statementQuery.data.month}
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted print:text-gray-600">Total spent</p>
              <p className="font-mono text-xl font-bold text-text print:text-black">
                {formatUsd(parseAtomic(statementQuery.data.totals.amount))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted print:text-gray-600">Card-cost equivalent</p>
              <p className="font-mono text-xl font-bold text-text print:text-black">
                {formatUsd(parseAtomic(statementQuery.data.totals.cardEquivalent))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted print:text-gray-600">Saved</p>
              <p className="font-mono text-xl font-bold text-brand-400 print:text-black">
                {formatUsd(
                  parseAtomic(statementQuery.data.totals.cardEquivalent) -
                    parseAtomic(statementQuery.data.totals.amount),
                )}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text print:text-black">By service</h3>
            <ul className="mt-2 grid gap-1 text-sm">
              {statementQuery.data.totals.byService.map((row) => (
                <li key={row.serviceId} className="flex justify-between text-muted print:text-gray-700">
                  <span>
                    {SERVICE_LABEL[row.serviceId]} ({row.count})
                  </span>
                  <span className="font-mono text-text print:text-black">
                    {formatUsd(parseAtomic(row.amount))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text print:text-black">By recipient</h3>
            <ul className="mt-2 grid gap-1 text-sm">
              {statementQuery.data.totals.byProvider.map((row) => (
                <li
                  key={`${row.role}:${row.recipient}`}
                  className="flex justify-between text-muted print:text-gray-700"
                >
                  <span>
                    {ROLE_LABEL[row.role]} · <span className="font-mono">{shortAddress(row.recipient)}</span>
                  </span>
                  <span className="font-mono text-text print:text-black">
                    {formatUsd(parseAtomic(row.amount))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text print:text-black">Payments</h3>
            <ul className="mt-2 grid gap-1 text-sm">
              {statementQuery.data.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between text-muted print:text-gray-700"
                >
                  <span>
                    {SERVICE_LABEL[payment.serviceId]} · {new Date(payment.settledAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-text print:text-black">
                      {formatUsd(parseAtomic(payment.amount))}
                    </span>
                    <span className="print:hidden">
                      <SolscanLink signature={payment.txSignature} />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
