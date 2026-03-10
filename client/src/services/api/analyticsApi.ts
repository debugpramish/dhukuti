import { httpRequest, unwrapData } from './httpClient';
import type {
  CustomerAnalytics,
  ProductAnalytics,
  SalesAnalytics,
} from './types';

type DateFilters = {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

type SalesPayload = SalesAnalytics | { sales: SalesAnalytics };
type SalesResponse = SalesPayload | { data: SalesPayload };

type CustomerPayload = CustomerAnalytics | { customers: CustomerAnalytics };
type CustomerResponse = CustomerPayload | { data: CustomerPayload };

type ProductPayload = ProductAnalytics | { products: ProductAnalytics };
type ProductResponse = ProductPayload | { data: ProductPayload };

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value: unknown): string {
  const parsed = new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function buildQuery(filters: DateFilters = {}): string {
  const query = new URLSearchParams();
  if (filters.dateFrom) {
    query.set('dateFrom', filters.dateFrom);
  }
  if (filters.dateTo) {
    query.set('dateTo', filters.dateTo);
  }
  if (typeof filters.limit === 'number' && Number.isFinite(filters.limit)) {
    query.set('limit', String(Math.max(1, Math.floor(filters.limit))));
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

function normalizeSales(payload: SalesPayload): SalesAnalytics {
  const sales = 'sales' in payload ? payload.sales : payload;

  return {
    summary: {
      totalRevenue: toNumber(sales.summary?.totalRevenue),
      totalOrders: toNumber(sales.summary?.totalOrders),
      totalUnitsSold: toNumber(sales.summary?.totalUnitsSold),
      averageOrderValue: toNumber(sales.summary?.averageOrderValue),
    },
    revenueTrend: Array.isArray(sales.revenueTrend)
      ? sales.revenueTrend.map((point) => ({
          date: String(point.date ?? ''),
          revenue: toNumber(point.revenue),
          orders: toNumber(point.orders),
          unitsSold: toNumber(point.unitsSold),
        }))
      : [],
    revenueByProduct: Array.isArray(sales.revenueByProduct)
      ? sales.revenueByProduct.map((row) => ({
          productId: row.productId ? String(row.productId) : undefined,
          title: String(row.title ?? ''),
          category: String(row.category ?? ''),
          revenue: toNumber(row.revenue),
          unitsSold: toNumber(row.unitsSold),
          ordersCount: toNumber(row.ordersCount),
        }))
      : [],
    revenueByCategory: Array.isArray(sales.revenueByCategory)
      ? sales.revenueByCategory.map((row) => ({
          category: String(row.category ?? ''),
          revenue: toNumber(row.revenue),
          unitsSold: toNumber(row.unitsSold),
          ordersCount: toNumber(row.ordersCount),
        }))
      : [],
    revenueByTrafficSource: Array.isArray(sales.revenueByTrafficSource)
      ? sales.revenueByTrafficSource.map((row) => ({
          source: String(row.source ?? ''),
          revenue: toNumber(row.revenue),
          ordersCount: toNumber(row.ordersCount),
          averageOrderValue: toNumber(row.averageOrderValue),
        }))
      : [],
    filters: {
      dateFrom: sales.filters?.dateFrom ? String(sales.filters.dateFrom) : undefined,
      dateTo: sales.filters?.dateTo ? String(sales.filters.dateTo) : undefined,
    },
  };
}

function normalizeCustomers(payload: CustomerPayload): CustomerAnalytics {
  const customers = 'customers' in payload ? payload.customers : payload;

  return {
    summary: {
      activeCustomers: toNumber(customers.summary?.activeCustomers),
      newCustomers: toNumber(customers.summary?.newCustomers),
      returningCustomers: toNumber(customers.summary?.returningCustomers),
      averageLtv: toNumber(customers.summary?.averageLtv),
      totalLtvRevenue: toNumber(customers.summary?.totalLtvRevenue),
    },
    ltv: Array.isArray(customers.ltv)
      ? customers.ltv.map((row) => ({
          customerKey: String(row.customerKey ?? ''),
          customerName: String(row.customerName ?? ''),
          customerEmail: String(row.customerEmail ?? ''),
          customerPhone: String(row.customerPhone ?? ''),
          customerLocation: String(row.customerLocation ?? ''),
          totalSpent: toNumber(row.totalSpent),
          ordersCount: toNumber(row.ordersCount),
          averageOrderValue: toNumber(row.averageOrderValue),
          firstOrderAt: toIso(row.firstOrderAt),
          lastOrderAt: toIso(row.lastOrderAt),
        }))
      : [],
    cohorts: Array.isArray(customers.cohorts)
      ? customers.cohorts.map((row) => ({
          cohort: String(row.cohort ?? ''),
          label: String(row.label ?? ''),
          size: toNumber(row.size),
          retention: Array.isArray(row.retention)
            ? row.retention.map((point) => ({
                monthOffset: toNumber(point.monthOffset),
                customers: toNumber(point.customers),
                ratePercent: toNumber(point.ratePercent),
              }))
            : [],
        }))
      : [],
    geography: Array.isArray(customers.geography)
      ? customers.geography.map((row) => ({
          location: String(row.location ?? ''),
          customers: toNumber(row.customers),
          orders: toNumber(row.orders),
          revenue: toNumber(row.revenue),
        }))
      : [],
    filters: {
      dateFrom: customers.filters?.dateFrom ? String(customers.filters.dateFrom) : undefined,
      dateTo: customers.filters?.dateTo ? String(customers.filters.dateTo) : undefined,
    },
  };
}

function normalizeProducts(payload: ProductPayload): ProductAnalytics {
  const products = 'products' in payload ? payload.products : payload;

  return {
    summary: {
      trackedProducts: toNumber(products.summary?.trackedProducts),
      viewEvents: toNumber(products.summary?.viewEvents),
      purchaseOrders: toNumber(products.summary?.purchaseOrders),
      conversionRatePercent: toNumber(products.summary?.conversionRatePercent),
      totalRevenue: toNumber(products.summary?.totalRevenue),
      totalEstimatedProfit: toNumber(products.summary?.totalEstimatedProfit),
      defaultCostRatioPercent: toNumber(products.summary?.defaultCostRatioPercent),
    },
    conversion: Array.isArray(products.conversion)
      ? products.conversion.map((row) => ({
          productId: String(row.productId ?? ''),
          title: String(row.title ?? ''),
          category: String(row.category ?? ''),
          viewEvents: toNumber(row.viewEvents),
          uniqueViewers: toNumber(row.uniqueViewers),
          purchaseOrders: toNumber(row.purchaseOrders),
          unitsSold: toNumber(row.unitsSold),
          conversionRatePercent: toNumber(row.conversionRatePercent),
          viewToPurchaseRatio: toNumber(row.viewToPurchaseRatio),
          revenue: toNumber(row.revenue),
          estimatedProfit: toNumber(row.estimatedProfit),
        }))
      : [],
    profitBySku: Array.isArray(products.profitBySku)
      ? products.profitBySku.map((row) => ({
          sku: String(row.sku ?? ''),
          title: String(row.title ?? ''),
          category: String(row.category ?? ''),
          unitsSold: toNumber(row.unitsSold),
          revenue: toNumber(row.revenue),
          estimatedCost: toNumber(row.estimatedCost),
          estimatedProfit: toNumber(row.estimatedProfit),
          profitMarginPercent: toNumber(row.profitMarginPercent),
        }))
      : [],
    filters: {
      dateFrom: products.filters?.dateFrom ? String(products.filters.dateFrom) : undefined,
      dateTo: products.filters?.dateTo ? String(products.filters.dateTo) : undefined,
    },
  };
}

export async function getSalesAnalytics(filters: DateFilters = {}): Promise<SalesAnalytics> {
  const response = await httpRequest<SalesResponse>(`/api/analytics/sales${buildQuery(filters)}`, {
    method: 'GET',
  });

  return normalizeSales(unwrapData<SalesPayload>(response));
}

export async function getCustomerAnalytics(filters: DateFilters = {}): Promise<CustomerAnalytics> {
  const response = await httpRequest<CustomerResponse>(`/api/analytics/customers${buildQuery(filters)}`, {
    method: 'GET',
  });

  return normalizeCustomers(unwrapData<CustomerPayload>(response));
}

export async function getProductAnalytics(filters: DateFilters = {}): Promise<ProductAnalytics> {
  const response = await httpRequest<ProductResponse>(`/api/analytics/products${buildQuery(filters)}`, {
    method: 'GET',
  });

  return normalizeProducts(unwrapData<ProductPayload>(response));
}
