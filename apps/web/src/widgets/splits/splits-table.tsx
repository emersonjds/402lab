'use client';

import { formatUsd, parseAtomic, type LiveEvent, type Provider } from '@402lab/shared';
import type { ApexOptions } from 'apexcharts';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SolscanLink } from '@/components/ui/solscan-link';
import { splitBatchListSchema, type SplitBatch } from '@/shared/api/schemas';
import { useApiQuery } from '@/shared/api/use-api-query';
import { useAllPayments, type PaymentWithAgent } from '@/shared/api/use-all-payments';
import { useLiveEvents } from '@/shared/api/use-live-events';
import { PROVIDERS, serviceInfo } from '@/shared/catalog/service-info';
import { shortAddress } from '@/shared/format/address';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const STATUS_BADGE: Record<SplitBatch['status'], BadgeColor> = {
  confirmed: 'success',
  pending: 'warning',
  failed: 'error',
};

const ROLE_LABEL: Record<SplitBatch['payouts'][number]['role'], string> = {
  provider: 'Provider',
  integrator: 'Integrator',
  platform: 'Platform',
};

// Fixed per the catalog's split rule (packages/shared/src/catalog.ts): 85% provider, 5%
// integrator, 10% platform on every service. Only the recipient address is secret, not the
// ratio — the web client never learns which address belongs to which provider.
const PROVIDER_BPS = 8_500n;
const PROVIDER_COLORS = ['#B6F23A', '#38D9F5', '#F5B83D', '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C', '#60A5FA', '#34D399'];

const HOURS = 24;
const MICRO_USDC = 1_000_000;

const Kpi = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <Card className="p-4">
    <p className="text-xs text-muted">{label}</p>
    <p className="mt-1.5 font-mono text-xl font-bold text-text">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
  </Card>
);

const Monogram = ({ name, color }: { name: string; color: string }) => (
  <span
    aria-hidden="true"
    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-gray-950"
    style={{ backgroundColor: color }}
  >
    {name.slice(0, 2).toUpperCase()}
  </span>
);

interface ProviderStats {
  provider: Provider;
  color: string;
  activeServices: number;
  calls: number;
  grossRevenue: bigint;
  providerShare: bigint;
  lastSettled: string | null;
}

const computeProviderStats = (payments: PaymentWithAgent[]): ProviderStats[] =>
  PROVIDERS.map((provider, index) => {
    const theirServices = new Set(
      [...new Set(payments.map((payment) => payment.serviceId))].filter(
        (id) => serviceInfo(id).provider.id === provider.id,
      ),
    );
    const theirPayments = payments.filter((payment) => serviceInfo(payment.serviceId).provider.id === provider.id);
    const grossRevenue = theirPayments.reduce((sum, payment) => sum + parseAtomic(payment.amount), 0n);

    return {
      provider,
      color: PROVIDER_COLORS[index % PROVIDER_COLORS.length] ?? '#B6F23A',
      activeServices: theirServices.size,
      calls: theirPayments.length,
      grossRevenue,
      providerShare: (grossRevenue * PROVIDER_BPS) / 10_000n,
      lastSettled: theirPayments[0]?.settledAt ?? null,
    };
  }).sort((a, b) => (b.grossRevenue > a.grossRevenue ? 1 : -1));

const ShareByProviderChart = ({ stats }: { stats: ProviderStats[] }) => {
  const ranked = stats.filter((stat) => stat.grossRevenue > 0n);

  const options: ApexOptions = {
    chart: { type: 'donut', foreColor: '#8A93A0' },
    labels: ranked.map((stat) => stat.provider.name),
    colors: ranked.map((stat) => stat.color),
    legend: { position: 'bottom', labels: { colors: '#8A93A0' } },
    dataLabels: { enabled: false },
    stroke: { show: false },
    tooltip: { theme: 'dark', y: { formatter: (value: number) => `$${value.toFixed(3)}` } },
  };
  const series = ranked.map((stat) => Number(stat.grossRevenue) / MICRO_USDC);

  return (
    <Card className="p-5">
      <h2 className="font-display font-semibold text-text">Share by provider</h2>
      <div className="mt-4">
        {series.length === 0 ? (
          <p className="text-sm text-muted">No settlements yet.</p>
        ) : (
          <Chart options={options} series={series} type="donut" height={280} />
        )}
      </div>
    </Card>
  );
};

const PayoutsPerHourChart = ({ payments, stats }: { payments: PaymentWithAgent[]; stats: ProviderStats[] }) => {
  const [now] = useState(() => Date.now());
  const ranked = stats.filter((stat) => stat.grossRevenue > 0n);

  const series = useMemo(
    () =>
      ranked.map((stat) => {
        const buckets = Array.from({ length: HOURS }, () => 0);

        for (const payment of payments) {
          if (serviceInfo(payment.serviceId).provider.id !== stat.provider.id) continue;
          const ageMs = now - new Date(payment.settledAt).getTime();
          const bucket = HOURS - 1 - Math.floor(ageMs / 3_600_000);
          if (bucket < 0 || bucket >= HOURS) continue;
          const payout = (parseAtomic(payment.amount) * PROVIDER_BPS) / 10_000n;
          buckets[bucket] = (buckets[bucket] ?? 0) + Number(payout) / MICRO_USDC;
        }

        return { name: stat.provider.name, data: buckets.map((value) => Number(value.toFixed(4))) };
      }),
    [payments, ranked, now],
  );

  const categories = Array.from({ length: HOURS }, (_, index) => {
    const hourAgo = HOURS - 1 - index;
    return `${String(new Date(now - hourAgo * 3_600_000).getHours()).padStart(2, '0')}h`;
  });

  const options: ApexOptions = {
    chart: { type: 'bar', stacked: true, toolbar: { show: false }, foreColor: '#8A93A0' },
    colors: ranked.map((stat) => stat.color),
    plotOptions: { bar: { borderRadius: 2, columnWidth: '70%' } },
    dataLabels: { enabled: false },
    grid: { borderColor: '#262B33', strokeDashArray: 4 },
    legend: { show: false },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (value: number) => `$${value.toFixed(2)}` } },
    tooltip: { theme: 'dark', y: { formatter: (value: number) => `$${value.toFixed(4)}` } },
  };

  return (
    <Card className="p-5">
      <h2 className="font-display font-semibold text-text">Provider payouts (85% share) per hour</h2>
      <div className="mt-4">
        <Chart options={options} series={series} type="bar" height={280} />
      </div>
    </Card>
  );
};

const ProviderLeaderboard = ({ stats }: { stats: ProviderStats[] }) => (
  <Card className="p-5">
    <h2 className="font-display font-semibold text-text">Provider settlement leaderboard</h2>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 font-medium">Provider</th>
            <th className="py-2 font-medium">Services</th>
            <th className="py-2 font-medium">Calls</th>
            <th className="py-2 font-medium">Gross revenue</th>
            <th className="py-2 font-medium">Provider share (85%)</th>
            <th className="py-2 font-medium">Last payment</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => (
            <tr key={stat.provider.id} className="border-b border-line/60">
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <Monogram name={stat.provider.name} color={stat.color} />
                  <span className="text-text">{stat.provider.name}</span>
                </div>
              </td>
              <td className="py-2.5 text-muted">{stat.activeServices}</td>
              <td className="py-2.5 text-muted">{stat.calls}</td>
              <td className="py-2.5 font-mono text-text">{formatUsd(stat.grossRevenue)}</td>
              <td className="py-2.5 font-mono text-brand-400">{formatUsd(stat.providerShare)}</td>
              <td className="py-2.5 text-muted">
                {stat.lastSettled ? new Date(stat.lastSettled).toLocaleTimeString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

const batchTotal = (batch: SplitBatch): bigint =>
  batch.payouts.reduce((sum, payout) => sum + parseAtomic(payout.amount), 0n);

const LiveBatchesFeed = ({ batches, onLiveEvent }: { batches: SplitBatch[]; onLiveEvent: (event: LiveEvent) => void }) => {
  useLiveEvents(onLiveEvent);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-text">Live split batches</h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-400">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-400" aria-hidden="true" />
          Live
        </span>
      </div>

      <ul className="mt-4 grid gap-3 max-h-[480px] overflow-y-auto">
        {batches
          .slice()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((batch) => (
            <li key={batch.id} className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted">{new Date(batch.createdAt).toLocaleTimeString()}</span>
                <Badge color={STATUS_BADGE[batch.status]}>{batch.status.toUpperCase()}</Badge>
              </div>
              <p className="mt-1 font-mono text-sm font-bold text-text">{formatUsd(batchTotal(batch))}</p>
              <ul className="mt-2 grid gap-1 text-xs">
                {batch.payouts.map((payout) => (
                  <li key={`${payout.role}:${payout.recipient}`} className="flex justify-between text-muted">
                    <span>
                      {ROLE_LABEL[payout.role]} · <span className="font-mono">{shortAddress(payout.recipient)}</span>
                    </span>
                    <span className="font-mono">{formatUsd(parseAtomic(payout.amount))}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <SolscanLink signature={batch.txSignature} />
              </div>
            </li>
          ))}
      </ul>
    </Card>
  );
};

const HowSplitWorks = () => (
  <Card className="p-5">
    <h2 className="font-display font-semibold text-text">How the split works</h2>
    <p className="mt-2 text-sm text-muted">
      Every HTTP 402 payment settles into one treasury transaction, then the split worker divides
      it on-chain: <span className="text-text">85% to the provider</span>,{' '}
      <span className="text-text">5% to the integrator</span>, and{' '}
      <span className="text-text">10% to the platform</span>. Provider and integrator shares are
      floored to the atomic unit; the remainder always goes to the platform, so every batch
      accounts for 100% of what was paid.
    </p>
  </Card>
);

export const SplitsTable = () => {
  const paymentsQuery = useAllPayments();
  const batchesQuery = useApiQuery('/splits', splitBatchListSchema);

  const payments = useMemo(() => (paymentsQuery.status === 'ready' ? paymentsQuery.payments : []), [paymentsQuery]);
  const stats = useMemo(() => computeProviderStats(payments), [payments]);

  const effectiveBatches = batchesQuery.status === 'ready' ? batchesQuery.data.batches : [];
  const errorMessage =
    paymentsQuery.status === 'error'
      ? paymentsQuery.message
      : batchesQuery.status === 'error'
        ? batchesQuery.message
        : null;

  const onLiveEvent = useCallback(
    (event: LiveEvent) => {
      if (event.type !== 'split.confirmed' && event.type !== 'split.failed') return;
      batchesQuery.refetch();
    },
    [batchesQuery],
  );

  const totalProviderPayouts = effectiveBatches
    .filter((batch) => batch.status === 'confirmed')
    .flatMap((batch) => batch.payouts)
    .filter((payout) => payout.role === 'provider')
    .reduce((sum, payout) => sum + parseAtomic(payout.amount), 0n);

  const providersWithRevenue = stats.filter((stat) => stat.grossRevenue > 0n).length;

  const avgSettlementSeconds = (() => {
    const createdAts = effectiveBatches.map((batch) => new Date(batch.createdAt).getTime()).sort((a, b) => a - b);
    if (createdAts.length < 2) return null;

    const gaps: number[] = [];
    for (let i = 1; i < createdAts.length; i += 1) {
      const previous = createdAts[i - 1];
      const current = createdAts[i];
      if (previous !== undefined && current !== undefined) gaps.push((current - previous) / 1_000);
    }

    return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  })();

  return (
    <div>
      <h1 className="font-display text-title-sm font-bold tracking-tight text-text">Provider revenue splits</h1>
      <p className="mt-1 text-sm text-muted">
        Autonomous multi-hop revenue distribution: every settlement splits 85% to the provider, 5%
        to the integrator and 10% to the platform via HTTP 402.
      </p>

      {errorMessage && (
        <div className="mt-6">
          <Alert variant="error" title="Couldn't load splits">
            {errorMessage}
          </Alert>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Settled to providers" value={formatUsd(totalProviderPayouts)} hint="across confirmed batches" />
        <Kpi label="Split batches" value={String(effectiveBatches.length)} hint={`${String(effectiveBatches.filter((b) => b.status === 'confirmed').length)} confirmed`} />
        <Kpi
          label="Providers paid"
          value={`${String(providersWithRevenue)} active`}
          hint={`of ${String(PROVIDERS.length)} on the catalog`}
        />
        <Kpi
          label="Avg settlement interval"
          value={avgSettlementSeconds === null ? '—' : `${avgSettlementSeconds.toFixed(1)}s`}
          hint="between batches"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ShareByProviderChart stats={stats} />
        <PayoutsPerHourChart payments={payments} stats={stats} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProviderLeaderboard stats={stats} />
        </div>
        <LiveBatchesFeed batches={effectiveBatches} onLiveEvent={onLiveEvent} />
      </div>

      <div className="mt-6">
        <HowSplitWorks />
      </div>
    </div>
  );
};
