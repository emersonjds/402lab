'use client';

import type { ApexOptions } from 'apexcharts';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

import { Card } from '@/components/ui/card';
import type { Payment } from '@/shared/api/schemas';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const HOURS = 24;
const MICRO_USDC = 1_000_000;

interface SpendChartProps {
  payments: Payment[];
}

export const SpendChart = ({ payments }: SpendChartProps) => {
  // Captured once at mount: a snapshot chart, not a ticking clock — avoids an impure Date.now()
  // call during render.
  const [now] = useState(() => Date.now());

  const { categories, series } = useMemo(() => {
    const buckets = Array.from({ length: HOURS }, () => 0);

    for (const payment of payments) {
      const ageMs = now - new Date(payment.settledAt).getTime();
      const bucket = HOURS - 1 - Math.floor(ageMs / 3_600_000);
      if (bucket < 0 || bucket >= HOURS) continue;
      buckets[bucket] = (buckets[bucket] ?? 0) + Number(payment.amount) / MICRO_USDC;
    }

    const categories = Array.from({ length: HOURS }, (_, index) => {
      const hourAgo = HOURS - 1 - index;
      return `${String(new Date(now - hourAgo * 3_600_000).getHours()).padStart(2, '0')}h`;
    });

    return {
      categories,
      series: [{ name: 'Spend', data: buckets.map((value) => Number(value.toFixed(4))) }],
    };
  }, [payments, now]);

  const options: ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, foreColor: '#8A93A0' },
    colors: ['#B6F23A'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0 } },
    grid: { borderColor: '#262B33', strokeDashArray: 4 },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (value: number) => `$${value.toFixed(2)}` } },
    tooltip: { theme: 'dark', y: { formatter: (value: number) => `$${value.toFixed(4)}` } },
  };

  return (
    <Card className="p-5">
      <h2 className="font-display font-semibold text-text">Spend activity (24h)</h2>
      <div className="mt-4">
        <Chart options={options} series={series} type="area" height={240} />
      </div>
    </Card>
  );
};
