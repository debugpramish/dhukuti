import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { DashboardOrderTrendBucket, DashboardOrderTrends } from '@/services/api/types';
import { cn } from '@/lib/utils';

type TrendPeriod = 'day' | 'month' | 'year';

const trendPeriodLabels: Record<TrendPeriod, string> = {
  day: 'Day',
  month: 'Month',
  year: 'Year',
};

const previousPeriodLabels: Record<TrendPeriod, string> = {
  day: 'previous day',
  month: 'previous month',
  year: 'previous year',
};

function formatSignedNumber(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

function formatSignedPercentage(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function getTrendColorClass(direction: DashboardOrderTrendBucket['direction']): string {
  if (direction === 'up') {
    return 'text-emerald-600';
  }

  if (direction === 'down') {
    return 'text-rose-600';
  }

  return 'text-slate-500';
}

function TrendDelta({
  bucket,
  period,
}: {
  bucket: DashboardOrderTrendBucket;
  period: TrendPeriod;
}) {
  const colorClass = getTrendColorClass(bucket.direction);

  return (
    <div className={cn('flex items-center gap-1 text-xs font-medium', colorClass)}>
      {bucket.direction === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
      {bucket.direction === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
      {bucket.direction === 'flat' ? <Minus className="h-3.5 w-3.5" /> : null}
      {bucket.direction === 'flat'
        ? `No change vs ${previousPeriodLabels[period]}`
        : `${formatSignedNumber(bucket.changeCount)} orders (${formatSignedPercentage(bucket.changePercent)}) vs ${previousPeriodLabels[period]}`}
    </div>
  );
}

export default function OrderTrendsChart({ trends }: { trends: DashboardOrderTrends }) {
  const [activePeriod, setActivePeriod] = useState<TrendPeriod>('day');

  const activeBucket = useMemo(() => {
    if (activePeriod === 'day') {
      return trends.day;
    }

    if (activePeriod === 'month') {
      return trends.month;
    }

    return trends.year;
  }, [activePeriod, trends.day, trends.month, trends.year]);

  const sortedPeriods: TrendPeriod[] = ['day', 'month', 'year'];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {sortedPeriods.map((period) => {
          const bucket = trends[period];
          const isActive = period === activePeriod;

          return (
            <button
              key={period}
              type="button"
              onClick={() => setActivePeriod(period)}
              className={cn(
                'rounded-lg border p-4 text-left transition-colors',
                isActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30',
              )}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {trendPeriodLabels[period]}
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{bucket.current}</p>
              <p className="text-xs text-muted-foreground">Current orders</p>
              <div className="mt-2">
                <TrendDelta bucket={bucket} period={period} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activeBucket.series} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={18}
              tick={{ fontSize: 12 }}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))' }}
              formatter={(value) => [`${Number(value ?? 0)} orders`, 'Orders']}
              labelFormatter={(label) => `${trendPeriodLabels[activePeriod]}: ${label}`}
            />
            <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

