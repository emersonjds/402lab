'use client';

import { formatUsd, parseAtomic, type LiveEvent } from '@402lab/shared';
import type { ApexOptions } from 'apexcharts';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { buttonStyles } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SolscanLink } from '@/components/ui/solscan-link';
import { splitBatchListSchema } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';
import { useAllPayments, type PaymentWithAgent } from '@/shared/api/use-all-payments';
import { useLiveEvents } from '@/shared/api/use-live-events';
import { PROVIDERS, serviceInfo, serviceLabel } from '@/shared/catalog/service-info';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const STATUS_BADGE: Record<'active' | 'paused', BadgeColor> = { active: 'success', paused: 'warning' };

const HOURS = 24;
const MICRO_USDC = 1_000_000;
const HALF_WINDOW_MS = 12 * 3_600_000;

const AGENT_COLORS = ['#B6F23A', '#38D9F5', '#F5B83D', '#A78BFA', '#F472B6', '#2DD4BF'];

const Kpi = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <Card className="p-4">
    <p className="text-xs text-muted">{label}</p>
    <p className="mt-1.5 font-mono text-xl font-bold text-text">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
  </Card>
);

const pctChange = (current: number, previous: number): string => {
  if (previous === 0) return current === 0 ? '±0%' : '+100%';
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}% vs. prior 12h`;
};

/** Splits a timestamp list at the 12h mark so every KPI can show a "vs. prior 12h" delta
 * without fabricating data the fixtures never generated. */
const splitAtHalfWindow = (payments: PaymentWithAgent[]): { recent: PaymentWithAgent[]; prior: PaymentWithAgent[] } => {
  const cutoff = Date.now() - HALF_WINDOW_MS;
  const recent: PaymentWithAgent[] = [];
  const prior: PaymentWithAgent[] = [];

  for (const payment of payments) {
    (new Date(payment.settledAt).getTime() >= cutoff ? recent : prior).push(payment);
  }

  return { recent, prior };
};

const AgentSpendChart = ({ payments, agentNames }: { payments: PaymentWithAgent[]; agentNames: string[] }) => {
  const [now] = useState(() => Date.now());

  const { categories, series } = useMemo(() => {
    const byAgent = new Map(agentNames.map((name) => [name, Array.from({ length: HOURS }, () => 0)]));

    for (const payment of payments) {
      const ageMs = now - new Date(payment.settledAt).getTime();
      const bucket = HOURS - 1 - Math.floor(ageMs / 3_600_000);
      if (bucket < 0 || bucket >= HOURS) continue;
      const buckets = byAgent.get(payment.agentName);
      if (!buckets) continue;
      buckets[bucket] = (buckets[bucket] ?? 0) + Number(payment.amount) / MICRO_USDC;
    }

    const categories = Array.from({ length: HOURS }, (_, index) => {
      const hourAgo = HOURS - 1 - index;
      return `${String(new Date(now - hourAgo * 3_600_000).getHours()).padStart(2, '0')}h`;
    });

    return {
      categories,
      series: agentNames.map((name) => ({
        name,
        data: (byAgent.get(name) ?? []).map((value) => Number(value.toFixed(4))),
      })),
    };
  }, [payments, agentNames, now]);

  const options: ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, foreColor: '#8A93A0', stacked: true },
    colors: AGENT_COLORS,
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 1.5 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
    grid: { borderColor: '#262B33', strokeDashArray: 4 },
    legend: { position: 'bottom', labels: { colors: '#8A93A0' } },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (value: number) => `$${value.toFixed(2)}` } },
    tooltip: { theme: 'dark', y: { formatter: (value: number) => `$${value.toFixed(4)}` } },
  };

  return (
    <Card className="p-5">
      <h2 className="font-display font-semibold text-text">Agent spend breakdown (24h)</h2>
      <div className="mt-4">
        <Chart options={options} series={series} type="area" height={260} />
      </div>
    </Card>
  );
};

const CallsByProvider = ({ payments }: { payments: PaymentWithAgent[] }) => {
  const { categories, series } = useMemo(() => {
    const counts = new Map<string, number>();

    for (const payment of payments) {
      const { name } = serviceInfo(payment.serviceId).provider;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    const ranked = PROVIDERS.map((provider) => ({ name: provider.name, count: counts.get(provider.name) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    return { categories: ranked.map((row) => row.name), series: [{ name: 'Calls', data: ranked.map((row) => row.count) }] };
  }, [payments]);

  const options: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, foreColor: '#8A93A0' },
    colors: ['#B6F23A'],
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '55%' } },
    dataLabels: { enabled: false },
    grid: { borderColor: '#262B33', strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false } },
    tooltip: { theme: 'dark' },
  };

  return (
    <Card className="p-5">
      <h2 className="font-display font-semibold text-text">Calls by provider (24h)</h2>
      <div className="mt-4">
        <Chart options={options} series={series} type="bar" height={260} />
      </div>
    </Card>
  );
};

interface AgentRow {
  id: string;
  agentName: string;
  status: 'active' | 'paused';
  spentToday: bigint;
  dailyCap: bigint;
  lastActivity: string | null;
}

const AgentAllowancesTable = ({ rows }: { rows: AgentRow[] }) => (
  <Card className="p-5">
    <div className="flex items-center justify-between">
      <h2 className="font-display font-semibold text-text">Active agent allowances</h2>
      <Link href="/app/agents" className="text-sm text-blue-light-400 hover:underline">
        Manage all →
      </Link>
    </div>

    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 font-medium">Agent</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Spent / budget</th>
            <th className="py-2 font-medium">Last activity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const progress = row.dailyCap > 0n ? Number((row.spentToday * 100n) / row.dailyCap) : 0;

            return (
              <tr key={row.id} className="border-b border-line/60">
                <td className="py-2.5 text-text">{row.agentName}</td>
                <td className="py-2.5">
                  <Badge color={STATUS_BADGE[row.status]}>{row.status.toUpperCase()}</Badge>
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-raised">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${String(Math.min(100, progress))}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-muted">
                      {formatUsd(row.spentToday)} / {formatUsd(row.dailyCap)}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 text-muted">
                  {row.lastActivity ? new Date(row.lastActivity).toLocaleTimeString() : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </Card>
);

const LiveStream = ({ payments }: { payments: PaymentWithAgent[] }) => {
  const [live, setLive] = useState<PaymentWithAgent[]>([]);

  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type !== 'payment.settled') return;

    setLive((previous) => [
      {
        id: event.paymentId,
        serviceId: event.serviceId,
        amount: event.amount,
        txSignature: event.txSignature,
        settledAt: event.settledAt,
        upstreamStatus: '200',
        agentName: '—',
        allowanceId: event.allowanceId ?? '',
      },
      ...previous,
    ]);
  }, []);

  useLiveEvents(handleEvent);

  const knownIds = new Set(live.map((payment) => payment.id));
  const rows = [...live, ...payments.filter((payment) => !knownIds.has(payment.id))]
    .sort((a, b) => b.settledAt.localeCompare(a.settledAt))
    .slice(0, 8);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-text">Live 402 settlement stream</h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-400">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-400" aria-hidden="true" />
          Live
        </span>
      </div>

      <ul className="mt-4 grid gap-2">
        {rows.map((payment) => (
          <li
            key={payment.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2 text-sm last:border-0 last:pb-0"
          >
            <span className="font-mono text-xs text-muted">
              {new Date(payment.settledAt).toLocaleTimeString()}
            </span>
            <span className="text-text">{payment.agentName}</span>
            <span className="text-muted">{serviceLabel(payment.serviceId)}</span>
            <span className="font-mono text-brand-400">{formatUsd(parseAtomic(payment.amount))}</span>
            <SolscanLink signature={payment.txSignature} />
          </li>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">No settlements yet.</p>}
      </ul>
    </Card>
  );
};

export const OverviewView = () => {
  const paymentsQuery = useAllPayments();
  const batchesQuery = useApiQuery('/splits', splitBatchListSchema);

  const payments = paymentsQuery.status === 'ready' ? paymentsQuery.payments : [];
  const allowances = paymentsQuery.status === 'ready' ? paymentsQuery.allowances : [];
  const agentNames = allowances.map((allowance) => allowance.agentName);

  const { recent, prior } = splitAtHalfWindow(payments);
  const recentSpend = recent.reduce((sum, payment) => sum + parseAtomic(payment.amount), 0n);
  const priorSpend = prior.reduce((sum, payment) => sum + parseAtomic(payment.amount), 0n);
  const totalSpend = recentSpend + priorSpend;
  const successRate =
    payments.length === 0
      ? 100
      : Math.round((payments.filter((p) => p.upstreamStatus === '200').length / payments.length) * 100);

  const avgSettlementSeconds = useMemo(() => {
    if (batchesQuery.status !== 'ready') return null;
    const createdAts = batchesQuery.data.batches
      .map((batch) => new Date(batch.createdAt).getTime())
      .sort((a, b) => a - b);
    if (createdAts.length < 2) return null;

    const gaps: number[] = [];
    for (let i = 1; i < createdAts.length; i += 1) {
      const previous = createdAts[i - 1];
      const current = createdAts[i];
      if (previous !== undefined && current !== undefined) gaps.push((current - previous) / 1_000);
    }

    return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  }, [batchesQuery]);

  const agentRows: AgentRow[] = allowances.map((allowance) => {
    const theirs = payments.filter((payment) => payment.allowanceId === allowance.id);
    const spentToday = theirs.reduce((sum, payment) => sum + parseAtomic(payment.amount), 0n);
    const lastActivity = theirs[0]?.settledAt ?? null;

    return {
      id: allowance.id,
      agentName: allowance.agentName,
      status: allowance.status,
      spentToday,
      dailyCap: parseAtomic(allowance.dailyCap),
      lastActivity,
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-title-sm font-bold tracking-tight text-text">Protocol overview</h1>
          <p className="mt-1 text-sm text-muted">
            Deterministic cryptographic allowances and real-time HTTP 402 micro-settlements across
            autonomous agents.
          </p>
        </div>
        <Link href="/app/agents" className={buttonStyles('primary')}>
          Create allowance
        </Link>
      </div>

      {paymentsQuery.status === 'error' && (
        <div className="mt-6">
          <Alert variant="error" title="Couldn't load overview data">
            {paymentsQuery.message}
          </Alert>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total registered agents" value={String(allowances.length)} hint={`${String(allowances.filter((a) => a.status === 'active').length)} active`} />
        <Kpi label="Spend (24h)" value={formatUsd(totalSpend)} hint={pctChange(Number(recentSpend), Number(priorSpend))} />
        <Kpi
          label="API calls (24h)"
          value={String(payments.length)}
          hint={`${String(successRate)}% success`}
        />
        <Kpi
          label="Avg settlement interval"
          value={avgSettlementSeconds === null ? '—' : `${avgSettlementSeconds.toFixed(1)}s`}
          hint="between split batches"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AgentSpendChart payments={payments} agentNames={agentNames} />
        <CallsByProvider payments={payments} />
      </div>

      <div className="mt-6">
        <AgentAllowancesTable rows={agentRows} />
      </div>

      <div className="mt-6">
        <LiveStream payments={payments} />
      </div>
    </div>
  );
};
