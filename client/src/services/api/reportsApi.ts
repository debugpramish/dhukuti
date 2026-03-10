import { getAuthToken } from '@/lib/auth';

import { API_BASE_URL, ApiError, httpRequest, unwrapData } from './httpClient';
import {
  ORDER_STATUS_VALUES,
  PRODUCT_STATUS_VALUES,
  type CustomerReport,
  type CustomerReportRow,
  type InventoryValuationReport,
  type InventoryValuationReportRow,
  type OrderStatus,
  type ProductPerformanceReport,
  type ProductPerformanceReportRow,
  type ProductStatus,
  type ReportDateFilters,
  type ReportExportFormat,
  type ReportType,
  type SalesReport,
  type SalesReportRow,
  type TaxReport,
  type TaxReportRow,
} from './types';

type ApiEnvelope<T> = T | { data: T };

function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUS_VALUES.some((status) => status === value);
}

function normalizeOrderStatus(value: string): OrderStatus {
  const normalized = String(value || '').toLowerCase();
  return isOrderStatus(normalized) ? normalized : 'pending';
}

function isProductStatus(value: string): value is ProductStatus {
  return PRODUCT_STATUS_VALUES.some((status) => status === value);
}

function normalizeProductStatus(value: string): ProductStatus {
  const normalized = String(value || '').toLowerCase();
  return isProductStatus(normalized) ? normalized : 'draft';
}

function normalizeFilters(filters: ReportDateFilters | undefined): ReportDateFilters {
  if (!filters) {
    return {};
  }

  const dateFrom = typeof filters.dateFrom === 'string' && filters.dateFrom.trim() ? filters.dateFrom.trim() : undefined;
  const dateTo = typeof filters.dateTo === 'string' && filters.dateTo.trim() ? filters.dateTo.trim() : undefined;

  return { dateFrom, dateTo };
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSalesRow(row: SalesReportRow): SalesReportRow {
  return {
    ...row,
    status: normalizeOrderStatus(row.status),
    subtotal: toNumber(row.subtotal),
    discountTotal: toNumber(row.discountTotal),
    total: toNumber(row.total),
  };
}

function normalizeTaxRow(row: TaxReportRow): TaxReportRow {
  return {
    ...row,
    taxableAmount: toNumber(row.taxableAmount),
    taxRatePercent: toNumber(row.taxRatePercent),
    estimatedTax: toNumber(row.estimatedTax),
    totalWithTax: toNumber(row.totalWithTax),
  };
}

function normalizeProductPerformanceRow(row: ProductPerformanceReportRow): ProductPerformanceReportRow {
  return {
    ...row,
    unitsSold: toNumber(row.unitsSold),
    orderCount: toNumber(row.orderCount),
    revenue: toNumber(row.revenue),
    averageUnitPrice: toNumber(row.averageUnitPrice),
  };
}

function normalizeInventoryValuationRow(row: InventoryValuationReportRow): InventoryValuationReportRow {
  return {
    ...row,
    productStatus: normalizeProductStatus(row.productStatus),
    stock: toNumber(row.stock),
    lowStockThreshold: toNumber(row.lowStockThreshold),
    unitPrice: toNumber(row.unitPrice),
    valuation: toNumber(row.valuation),
    lowStock: Boolean(row.lowStock),
  };
}

function normalizeCustomerRow(row: CustomerReportRow): CustomerReportRow {
  return {
    ...row,
    ordersCount: toNumber(row.ordersCount),
    completedOrders: toNumber(row.completedOrders),
    cancelledOrders: toNumber(row.cancelledOrders),
    totalSpent: toNumber(row.totalSpent),
    averageOrderValue: toNumber(row.averageOrderValue),
    itemsPurchased: toNumber(row.itemsPurchased),
  };
}

function buildQuery(filters: ReportDateFilters = {}): string {
  const normalized = normalizeFilters(filters);
  const query = new URLSearchParams();

  if (normalized.dateFrom) {
    query.set('dateFrom', normalized.dateFrom);
  }

  if (normalized.dateTo) {
    query.set('dateTo', normalized.dateTo);
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export async function getSalesReport(filters: ReportDateFilters = {}): Promise<SalesReport> {
  const response = await httpRequest<ApiEnvelope<SalesReport>>(`/api/reports/sales${buildQuery(filters)}`, {
    method: 'GET',
  });

  const payload = unwrapData<SalesReport>(response);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  return {
    ...payload,
    filters: normalizeFilters(payload.filters),
    summary: {
      ordersCount: toNumber(payload.summary?.ordersCount),
      completedOrders: toNumber(payload.summary?.completedOrders),
      cancelledOrders: toNumber(payload.summary?.cancelledOrders),
      grossSales: toNumber(payload.summary?.grossSales),
      discountTotal: toNumber(payload.summary?.discountTotal),
      netSales: toNumber(payload.summary?.netSales),
      averageOrderValue: toNumber(payload.summary?.averageOrderValue),
    },
    rows: rows.map(normalizeSalesRow),
  };
}

export async function getTaxReport(filters: ReportDateFilters = {}): Promise<TaxReport> {
  const response = await httpRequest<ApiEnvelope<TaxReport>>(`/api/reports/tax${buildQuery(filters)}`, {
    method: 'GET',
  });

  const payload = unwrapData<TaxReport>(response);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  return {
    ...payload,
    filters: normalizeFilters(payload.filters),
    summary: {
      taxableOrders: toNumber(payload.summary?.taxableOrders),
      taxRatePercent: toNumber(payload.summary?.taxRatePercent),
      taxableSales: toNumber(payload.summary?.taxableSales),
      estimatedTaxTotal: toNumber(payload.summary?.estimatedTaxTotal),
      grossWithTax: toNumber(payload.summary?.grossWithTax),
    },
    rows: rows.map(normalizeTaxRow),
  };
}

export async function getProductPerformanceReport(filters: ReportDateFilters = {}): Promise<ProductPerformanceReport> {
  const response = await httpRequest<ApiEnvelope<ProductPerformanceReport>>(
    `/api/reports/product-performance${buildQuery(filters)}`,
    {
      method: 'GET',
    },
  );

  const payload = unwrapData<ProductPerformanceReport>(response);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  return {
    ...payload,
    filters: normalizeFilters(payload.filters),
    summary: {
      uniqueProducts: toNumber(payload.summary?.uniqueProducts),
      totalUnitsSold: toNumber(payload.summary?.totalUnitsSold),
      totalRevenue: toNumber(payload.summary?.totalRevenue),
      averageRevenuePerProduct: toNumber(payload.summary?.averageRevenuePerProduct),
    },
    rows: rows.map(normalizeProductPerformanceRow),
  };
}

export async function getInventoryValuationReport(): Promise<InventoryValuationReport> {
  const response = await httpRequest<ApiEnvelope<InventoryValuationReport>>('/api/reports/inventory-valuation', {
    method: 'GET',
  });

  const payload = unwrapData<InventoryValuationReport>(response);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  return {
    ...payload,
    summary: {
      skuCount: toNumber(payload.summary?.skuCount),
      totalUnitsInStock: toNumber(payload.summary?.totalUnitsInStock),
      lowStockSkuCount: toNumber(payload.summary?.lowStockSkuCount),
      totalInventoryValue: toNumber(payload.summary?.totalInventoryValue),
    },
    rows: rows.map(normalizeInventoryValuationRow),
  };
}

export async function getCustomerReport(filters: ReportDateFilters = {}): Promise<CustomerReport> {
  const response = await httpRequest<ApiEnvelope<CustomerReport>>(`/api/reports/customers${buildQuery(filters)}`, {
    method: 'GET',
  });

  const payload = unwrapData<CustomerReport>(response);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  return {
    ...payload,
    filters: normalizeFilters(payload.filters),
    summary: {
      customerCount: toNumber(payload.summary?.customerCount),
      totalOrders: toNumber(payload.summary?.totalOrders),
      activeCustomers: toNumber(payload.summary?.activeCustomers),
      returningCustomers: toNumber(payload.summary?.returningCustomers),
      totalRevenue: toNumber(payload.summary?.totalRevenue),
    },
    rows: rows.map(normalizeCustomerRow),
  };
}

function buildExportPath(reportType: ReportType, format: ReportExportFormat, filters: ReportDateFilters = {}): string {
  const query = new URLSearchParams();
  query.set('format', format);

  const normalizedFilters = normalizeFilters(filters);
  if (normalizedFilters.dateFrom) {
    query.set('dateFrom', normalizedFilters.dateFrom);
  }
  if (normalizedFilters.dateTo) {
    query.set('dateTo', normalizedFilters.dateTo);
  }

  return `/api/reports/${reportType}/export?${query.toString()}`;
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function extractFileName(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) {
    return fallback;
  }

  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return match?.[1] ? match[1] : fallback;
}

export async function exportReport(reportType: ReportType, format: ReportExportFormat, filters: ReportDateFilters = {}) {
  const token = getAuthToken();
  const path = buildExportPath(reportType, format, filters);
  const response = await fetch(resolveUrl(path), {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    let message = 'Unable to export report';

    try {
      const payload = (await response.json()) as { message?: string };
      if (typeof payload.message === 'string') {
        message = payload.message;
      }
    } catch {
      // Ignore parse errors and keep default message.
    }

    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const fallbackExt = format === 'csv' ? 'csv' : 'xls';
  const fallbackName = `${reportType}-report.${fallbackExt}`;
  const fileName = extractFileName(response.headers.get('content-disposition'), fallbackName);

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
