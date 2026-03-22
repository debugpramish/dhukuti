import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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
  const [activePeriod, setActivePeriod] = useState<TrendPeriod>('month');

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
    <div className="space-y-5" style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Order trend</p>
          <p className="mt-1 text-sm text-slate-500">Compare performance by day, month, or year</p>
        </div>

        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
          {sortedPeriods.map((period) => {
            const isActive = period === activePeriod;

            return (
              <button
                key={period}
                type="button"
                onClick={() => setActivePeriod(period)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-800',
                )}
              >
                {trendPeriodLabels[period]}
              </button>
            );
          })}
        </div>
      </div>

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
                'rounded-xl border p-4 text-left transition-all',
                isActive
                  ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/50'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {trendPeriodLabels[period]}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{bucket.current}</p>
              <p className="text-xs text-slate-500">Orders in this period</p>
              <div className="mt-2">
                <TrendDelta bucket={bucket} period={period} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="h-[280px] w-full overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={activeBucket.series} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="ordersAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={18}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
            />
            <Tooltip
              cursor={{ stroke: '#a5b4fc', strokeDasharray: '4 4' }}
              contentStyle={{ borderRadius: '10px', borderColor: '#cbd5e1' }}
              formatter={(value) => [`${Number(value ?? 0)} orders`, 'Orders']}
              labelFormatter={(label) => `${trendPeriodLabels[activePeriod]}: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#ordersAreaFill)"
              dot={{ r: 3, fill: '#ffffff', stroke: '#6366f1', strokeWidth: 2 }}
              activeDot={{ r: 4, fill: '#6366f1' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

