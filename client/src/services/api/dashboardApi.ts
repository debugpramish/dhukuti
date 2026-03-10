import { httpRequest, unwrapData } from './httpClient';
import {
  ORDER_STATUS_VALUES,
  type DashboardOrderTrendBucket,
  type DashboardOrderTrendDirection,
  type DashboardOrderTrendPoint,
  type DashboardOrderTrends,
  type DashboardSummary,
  type OrderStatus,
} from './types';

type DashboardSummaryPayload = DashboardSummary | { summary: DashboardSummary };
type DashboardSummaryResponse = DashboardSummaryPayload | { data: DashboardSummaryPayload };

type DashboardOrderTrendsApiPayload = {
  trends?: {
    day?: DashboardOrderTrendBucket;
    month?: DashboardOrderTrendBucket;
    year?: DashboardOrderTrendBucket;
  };
  day?: DashboardOrderTrendBucket;
  month?: DashboardOrderTrendBucket;
  year?: DashboardOrderTrendBucket;
  generatedAt?: string;
};

type DashboardOrderTrendsResponse =
  | DashboardOrderTrendsApiPayload
  | { data: DashboardOrderTrendsApiPayload };

function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUS_VALUES.some((status) => status === value);
}

function normalizeStatus(status: string): OrderStatus {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  return isOrderStatus(normalized) ? normalized : 'pending';
}

function normalizeSummary(payload: DashboardSummaryPayload): DashboardSummary {
  const summary = 'summary' in payload ? payload.summary : payload;
  const recentOrders = Array.isArray(summary.recentOrders) ? summary.recentOrders : [];

  return {
    totalProducts: Number(summary.totalProducts ?? 0),
    totalOrders: Number(summary.totalOrders ?? 0),
    totalRevenue: Number(summary.totalRevenue ?? 0),
    recentOrders: recentOrders.map((order) => ({
      ...order,
      status: normalizeStatus(order.status),
    })),
  };
}

function isTrendDirection(value: string): value is DashboardOrderTrendDirection {
  return value === 'up' || value === 'down' || value === 'flat';
}

function normalizeTrendDirection(value: string): DashboardOrderTrendDirection {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return isTrendDirection(normalized) ? normalized : 'flat';
}

function normalizeTrendSeries(series: DashboardOrderTrendPoint[]): DashboardOrderTrendPoint[] {
  const trendSeries = Array.isArray(series) ? series : [];

  return trendSeries.map((point, index) => ({
    key: typeof point.key === 'string' && point.key.trim() ? point.key : `point-${index}`,
    label: typeof point.label === 'string' && point.label.trim() ? point.label : `Point ${index + 1}`,
    count: Number(point.count ?? 0),
  }));
}

function normalizeTrendBucket(bucket: DashboardOrderTrendBucket): DashboardOrderTrendBucket {
  return {
    current: Number(bucket.current ?? 0),
    previous: Number(bucket.previous ?? 0),
    changeCount: Number(bucket.changeCount ?? 0),
    changePercent: Number(bucket.changePercent ?? 0),
    direction: normalizeTrendDirection(bucket.direction),
    series: normalizeTrendSeries(bucket.series),
  };
}

function createEmptyTrendBucket(): DashboardOrderTrendBucket {
  return {
    current: 0,
    previous: 0,
    changeCount: 0,
    changePercent: 0,
    direction: 'flat',
    series: [],
  };
}

function normalizeOrderTrends(payload: DashboardOrderTrendsApiPayload): DashboardOrderTrends {
  const trendsContainer = payload.trends ?? payload;
  const dayTrend = trendsContainer.day ?? createEmptyTrendBucket();
  const monthTrend = trendsContainer.month ?? createEmptyTrendBucket();
  const yearTrend = trendsContainer.year ?? createEmptyTrendBucket();

  return {
    day: normalizeTrendBucket(dayTrend),
    month: normalizeTrendBucket(monthTrend),
    year: normalizeTrendBucket(yearTrend),
    generatedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : new Date(0).toISOString(),
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await httpRequest<DashboardSummaryResponse>('/api/dashboard/summary', {
    method: 'GET',
  });

  return normalizeSummary(unwrapData<DashboardSummaryPayload>(response));
}

export async function getDashboardOrderTrends(): Promise<DashboardOrderTrends> {
  const response = await httpRequest<DashboardOrderTrendsResponse>('/api/dashboard/order-trends', {
    method: 'GET',
  });

  return normalizeOrderTrends(unwrapData<DashboardOrderTrendsApiPayload>(response));
}
