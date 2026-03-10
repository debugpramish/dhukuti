import express from 'express';
import mongoose from 'mongoose';

import OrderModel from '../models/order.model';
import ProductModel from '../models/product.model';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import { ensureMerchantDemoData } from '../services/merchant-data.service';

const reportsRouter = express.Router();

const REPORT_TYPE_VALUES = [
  'sales',
  'tax',
  'product-performance',
  'inventory-valuation',
  'customers',
] as const;

type ReportType = (typeof REPORT_TYPE_VALUES)[number];

const EXPORT_FORMAT_VALUES = ['csv', 'excel'] as const;

type ExportFormat = (typeof EXPORT_FORMAT_VALUES)[number];

type CsvValue = string | number | boolean | null | undefined;

type ExportColumn = {
  key: string;
  label: string;
};

type DateFilter = {
  dateFrom?: string;
  dateTo?: string;
  range?: {
    $gte?: Date;
    $lt?: Date;
  };
};

type ReportOrderItem = {
  title: string;
  quantity: number;
  unitPrice: number;
  sku?: string;
  variantName?: string;
};

type ReportOrder = {
  _id: mongoose.Types.ObjectId;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerLocation: string;
  status: string;
  subtotal: number;
  productDiscountTotal: number;
  couponDiscountTotal: number;
  discountTotal: number;
  total: number;
  createdAt: Date;
  items: ReportOrderItem[];
};

type ReportProductVariant = {
  _id: mongoose.Types.ObjectId;
  sku: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
  isDefault: boolean;
};

type ReportProduct = {
  _id: mongoose.Types.ObjectId;
  title: string;
  status: string;
  price: number;
  discountType: string;
  discountValue: number;
  variants: ReportProductVariant[];
};

type SalesReportRow = {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  total: number;
};

type SalesReportResponse = {
  reportType: 'sales';
  generatedAt: string;
  filters: {
    dateFrom?: string;
    dateTo?: string;
  };
  summary: {
    ordersCount: number;
    completedOrders: number;
    cancelledOrders: number;
    grossSales: number;
    discountTotal: number;
    netSales: number;
    averageOrderValue: number;
  };
  rows: SalesReportRow[];
};

type TaxReportRow = {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  taxableAmount: number;
  taxRatePercent: number;
  estimatedTax: number;
  totalWithTax: number;
};

type TaxReportResponse = {
  reportType: 'tax';
  generatedAt: string;
  filters: {
    dateFrom?: string;
    dateTo?: string;
  };
  summary: {
    taxableOrders: number;
    taxRatePercent: number;
    taxableSales: number;
    estimatedTaxTotal: number;
    grossWithTax: number;
  };
  rows: TaxReportRow[];
};

type ProductPerformanceRow = {
  productTitle: string;
  sku: string;
  variantName: string;
  unitsSold: number;
  orderCount: number;
  revenue: number;
  averageUnitPrice: number;
};

type ProductPerformanceResponse = {
  reportType: 'product-performance';
  generatedAt: string;
  filters: {
    dateFrom?: string;
    dateTo?: string;
  };
  summary: {
    uniqueProducts: number;
    totalUnitsSold: number;
    totalRevenue: number;
    averageRevenuePerProduct: number;
  };
  rows: ProductPerformanceRow[];
};

type InventoryValuationRow = {
  productTitle: string;
  sku: string;
  variantName: string;
  productStatus: string;
  stock: number;
  lowStockThreshold: number;
  unitPrice: number;
  valuation: number;
  lowStock: boolean;
};

type InventoryValuationResponse = {
  reportType: 'inventory-valuation';
  generatedAt: string;
  summary: {
    skuCount: number;
    totalUnitsInStock: number;
    lowStockSkuCount: number;
    totalInventoryValue: number;
  };
  rows: InventoryValuationRow[];
};

type CustomerReportRow = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerLocation: string;
  ordersCount: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  itemsPurchased: number;
  firstOrderAt: string;
  lastOrderAt: string;
};

type CustomerReportResponse = {
  reportType: 'customers';
  generatedAt: string;
  filters: {
    dateFrom?: string;
    dateTo?: string;
  };
  summary: {
    customerCount: number;
    totalOrders: number;
    activeCustomers: number;
    returningCustomers: number;
    totalRevenue: number;
  };
  rows: CustomerReportRow[];
};

type ReportPayload =
  | SalesReportResponse
  | TaxReportResponse
  | ProductPerformanceResponse
  | InventoryValuationResponse
  | CustomerReportResponse;

function isReportType(value: string): value is ReportType {
  return REPORT_TYPE_VALUES.some((type) => type === value);
}

function isExportFormat(value: string): value is ExportFormat {
  return EXPORT_FORMAT_VALUES.some((format) => format === value);
}

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatIsoDate(value: Date): string {
  return value.toISOString();
}

function normalizeDiscountType(discountType: string): 'none' | 'percentage' | 'fixed' {
  if (discountType === 'percentage' || discountType === 'fixed') {
    return discountType;
  }

  return 'none';
}

function calculateDiscountedPrice(price: number, discountType: string, discountValue: number): number {
  const normalizedPrice = roundCurrency(Math.max(price, 0));
  const normalizedDiscountValue = roundCurrency(Math.max(discountValue, 0));

  if (discountType === 'percentage') {
    const percentage = Math.min(normalizedDiscountValue, 95);
    return roundCurrency(Math.max(0, normalizedPrice - (normalizedPrice * percentage) / 100));
  }

  if (discountType === 'fixed') {
    return roundCurrency(Math.max(0, normalizedPrice - normalizedDiscountValue));
  }

  return normalizedPrice;
}

function parseDateInput(input: unknown): Date | null {
  if (typeof input !== 'string') {
    return null;
  }

  const raw = input.trim();
  if (!raw) {
    return null;
  }

  const simpleDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (simpleDateMatch) {
    const year = Number(simpleDateMatch[1]);
    const month = Number(simpleDateMatch[2]);
    const day = Number(simpleDateMatch[3]);

    const utcDate = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(utcDate.getTime())) {
      return null;
    }

    return utcDate;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatDateFilterValue(value: Date | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.toISOString().slice(0, 10);
}

function resolveDateFilter(req: express.Request): { filter?: DateFilter; error?: string } {
  const from = parseDateInput(req.query.dateFrom);
  const to = parseDateInput(req.query.dateTo);

  if (typeof req.query.dateFrom === 'string' && req.query.dateFrom.trim() && !from) {
    return { error: 'Invalid dateFrom query parameter' };
  }

  if (typeof req.query.dateTo === 'string' && req.query.dateTo.trim() && !to) {
    return { error: 'Invalid dateTo query parameter' };
  }

  if (!from && !to) {
    return { filter: {} };
  }

  const range: DateFilter['range'] = {};

  if (from) {
    range.$gte = from;
  }

  if (to) {
    const inclusiveEnd = new Date(to.getTime());
    inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() + 1);
    range.$lt = inclusiveEnd;
  }

  if (range.$gte && range.$lt && range.$gte >= range.$lt) {
    return { error: 'dateFrom must be earlier than or equal to dateTo' };
  }

  return {
    filter: {
      dateFrom: formatDateFilterValue(from),
      dateTo: formatDateFilterValue(to),
      range,
    },
  };
}

function buildOrderMatch(ownerId: mongoose.Types.ObjectId, dateFilter: DateFilter): Record<string, unknown> {
  const match: Record<string, unknown> = { ownerId };

  if (dateFilter.range && (dateFilter.range.$gte || dateFilter.range.$lt)) {
    match.createdAt = dateFilter.range;
  }

  return match;
}

async function loadOrders(ownerId: mongoose.Types.ObjectId, dateFilter: DateFilter): Promise<ReportOrder[]> {
  const orders = await OrderModel.find(buildOrderMatch(ownerId, dateFilter))
    .sort({ createdAt: -1 })
    .select({
      orderNumber: 1,
      customerName: 1,
      customerEmail: 1,
      customerPhone: 1,
      customerLocation: 1,
      status: 1,
      subtotal: 1,
      productDiscountTotal: 1,
      couponDiscountTotal: 1,
      discountTotal: 1,
      total: 1,
      createdAt: 1,
      items: 1,
    })
    .lean<ReportOrder[]>();

  return Array.isArray(orders) ? orders : [];
}

function parseTaxRatePercent(): number {
  const raw = Number(process.env.REPORT_TAX_RATE_PERCENT ?? 13);
  if (!Number.isFinite(raw)) {
    return 13;
  }

  return Math.max(0, raw);
}

async function buildSalesReport(ownerId: mongoose.Types.ObjectId, dateFilter: DateFilter): Promise<SalesReportResponse> {
  const orders = await loadOrders(ownerId, dateFilter);

  const rows: SalesReportRow[] = orders.map((order) => ({
    orderNumber: order.orderNumber,
    createdAt: formatIsoDate(order.createdAt),
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    status: order.status,
    subtotal: roundCurrency(order.subtotal),
    discountTotal: roundCurrency(order.discountTotal),
    total: roundCurrency(order.total),
  }));

  const completedOrders = orders.filter((order) => order.status !== 'cancelled');
  const ordersCount = orders.length;
  const completedOrdersCount = completedOrders.length;
  const cancelledOrders = ordersCount - completedOrdersCount;

  const grossSales = roundCurrency(completedOrders.reduce((sum, order) => sum + order.subtotal, 0));
  const discountTotal = roundCurrency(completedOrders.reduce((sum, order) => sum + order.discountTotal, 0));
  const netSales = roundCurrency(completedOrders.reduce((sum, order) => sum + order.total, 0));
  const averageOrderValue = completedOrdersCount > 0 ? roundCurrency(netSales / completedOrdersCount) : 0;

  return {
    reportType: 'sales',
    generatedAt: new Date().toISOString(),
    filters: {
      dateFrom: dateFilter.dateFrom,
      dateTo: dateFilter.dateTo,
    },
    summary: {
      ordersCount,
      completedOrders: completedOrdersCount,
      cancelledOrders,
      grossSales,
      discountTotal,
      netSales,
      averageOrderValue,
    },
    rows,
  };
}

async function buildTaxReport(ownerId: mongoose.Types.ObjectId, dateFilter: DateFilter): Promise<TaxReportResponse> {
  const orders = await loadOrders(ownerId, dateFilter);
  const taxRatePercent = parseTaxRatePercent();

  const taxableOrders = orders.filter((order) => order.status !== 'cancelled');

  const rows: TaxReportRow[] = taxableOrders.map((order) => {
    const taxableAmount = roundCurrency(order.total);
    const estimatedTax = roundCurrency((taxableAmount * taxRatePercent) / 100);

    return {
      orderNumber: order.orderNumber,
      createdAt: formatIsoDate(order.createdAt),
      customerName: order.customerName,
      taxableAmount,
      taxRatePercent,
      estimatedTax,
      totalWithTax: roundCurrency(taxableAmount + estimatedTax),
    };
  });

  const taxableSales = roundCurrency(rows.reduce((sum, row) => sum + row.taxableAmount, 0));
  const estimatedTaxTotal = roundCurrency(rows.reduce((sum, row) => sum + row.estimatedTax, 0));

  return {
    reportType: 'tax',
    generatedAt: new Date().toISOString(),
    filters: {
      dateFrom: dateFilter.dateFrom,
      dateTo: dateFilter.dateTo,
    },
    summary: {
      taxableOrders: rows.length,
      taxRatePercent,
      taxableSales,
      estimatedTaxTotal,
      grossWithTax: roundCurrency(taxableSales + estimatedTaxTotal),
    },
    rows,
  };
}

async function buildProductPerformanceReport(
  ownerId: mongoose.Types.ObjectId,
  dateFilter: DateFilter,
): Promise<ProductPerformanceResponse> {
  const orders = await loadOrders(ownerId, dateFilter);

  type ProductAccumulator = {
    productTitle: string;
    sku: string;
    variantName: string;
    unitsSold: number;
    orderCount: number;
    revenue: number;
    orderKeys: Set<string>;
  };

  const map = new Map<string, ProductAccumulator>();

  orders
    .filter((order) => order.status !== 'cancelled')
    .forEach((order) => {
      order.items.forEach((item) => {
        const sku = item.sku || 'N/A';
        const variantName = item.variantName || 'Default';
        const key = `${item.title}::${sku}`;

        const existing = map.get(key) ?? {
          productTitle: item.title,
          sku,
          variantName,
          unitsSold: 0,
          orderCount: 0,
          revenue: 0,
          orderKeys: new Set<string>(),
        };

        existing.unitsSold += item.quantity;
        existing.revenue += item.unitPrice * item.quantity;
        existing.orderKeys.add(order.orderNumber);

        map.set(key, existing);
      });
    });

  const rows: ProductPerformanceRow[] = [...map.values()]
    .map((entry) => {
      const orderCount = entry.orderKeys.size;
      const revenue = roundCurrency(entry.revenue);
      const unitsSold = entry.unitsSold;
      const averageUnitPrice = unitsSold > 0 ? roundCurrency(revenue / unitsSold) : 0;

      return {
        productTitle: entry.productTitle,
        sku: entry.sku,
        variantName: entry.variantName,
        unitsSold,
        orderCount,
        revenue,
        averageUnitPrice,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const totalUnitsSold = rows.reduce((sum, row) => sum + row.unitsSold, 0);
  const totalRevenue = roundCurrency(rows.reduce((sum, row) => sum + row.revenue, 0));

  return {
    reportType: 'product-performance',
    generatedAt: new Date().toISOString(),
    filters: {
      dateFrom: dateFilter.dateFrom,
      dateTo: dateFilter.dateTo,
    },
    summary: {
      uniqueProducts: rows.length,
      totalUnitsSold,
      totalRevenue,
      averageRevenuePerProduct: rows.length > 0 ? roundCurrency(totalRevenue / rows.length) : 0,
    },
    rows,
  };
}

async function buildInventoryValuationReport(ownerId: mongoose.Types.ObjectId): Promise<InventoryValuationResponse> {
  const products = await ProductModel.find({ ownerId })
    .select({
      title: 1,
      status: 1,
      price: 1,
      discountType: 1,
      discountValue: 1,
      variants: 1,
    })
    .lean<ReportProduct[]>();

  const rows: InventoryValuationRow[] = [];

  products.forEach((product) => {
    const unitPrice = calculateDiscountedPrice(
      product.price,
      normalizeDiscountType(product.discountType),
      Number(product.discountValue ?? 0),
    );

    product.variants.forEach((variant) => {
      const stock = Number(variant.stock ?? 0);
      const threshold = Number(variant.lowStockThreshold ?? 0);
      const valuation = roundCurrency(unitPrice * stock);

      rows.push({
        productTitle: product.title,
        sku: variant.sku,
        variantName: variant.name,
        productStatus: product.status,
        stock,
        lowStockThreshold: threshold,
        unitPrice,
        valuation,
        lowStock: stock <= threshold,
      });
    });
  });

  rows.sort((a, b) => b.valuation - a.valuation);

  const totalUnitsInStock = rows.reduce((sum, row) => sum + row.stock, 0);
  const totalInventoryValue = roundCurrency(rows.reduce((sum, row) => sum + row.valuation, 0));
  const lowStockSkuCount = rows.filter((row) => row.lowStock).length;

  return {
    reportType: 'inventory-valuation',
    generatedAt: new Date().toISOString(),
    summary: {
      skuCount: rows.length,
      totalUnitsInStock,
      lowStockSkuCount,
      totalInventoryValue,
    },
    rows,
  };
}

async function buildCustomerReport(ownerId: mongoose.Types.ObjectId, dateFilter: DateFilter): Promise<CustomerReportResponse> {
  const orders = await loadOrders(ownerId, dateFilter);

  type CustomerAccumulator = {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerLocation: string;
    ordersCount: number;
    completedOrders: number;
    cancelledOrders: number;
    totalSpent: number;
    itemsPurchased: number;
    firstOrderAt: Date;
    lastOrderAt: Date;
  };

  const map = new Map<string, CustomerAccumulator>();

  orders.forEach((order) => {
    const customerEmail = order.customerEmail.toLowerCase();
    const existing = map.get(customerEmail) ?? {
      customerName: order.customerName,
      customerEmail,
      customerPhone: order.customerPhone || '',
      customerLocation: order.customerLocation || '',
      ordersCount: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalSpent: 0,
      itemsPurchased: 0,
      firstOrderAt: order.createdAt,
      lastOrderAt: order.createdAt,
    };

    existing.ordersCount += 1;
    existing.itemsPurchased += order.items.reduce((sum, item) => sum + item.quantity, 0);

    if (order.status === 'cancelled') {
      existing.cancelledOrders += 1;
    } else {
      existing.completedOrders += 1;
      existing.totalSpent += order.total;
    }

    if (order.createdAt < existing.firstOrderAt) {
      existing.firstOrderAt = order.createdAt;
    }

    if (order.createdAt > existing.lastOrderAt) {
      existing.lastOrderAt = order.createdAt;
    }

    map.set(customerEmail, existing);
  });

  const rows: CustomerReportRow[] = [...map.values()]
    .map((entry) => {
      const totalSpent = roundCurrency(entry.totalSpent);

      return {
        customerName: entry.customerName,
        customerEmail: entry.customerEmail,
        customerPhone: entry.customerPhone,
        customerLocation: entry.customerLocation,
        ordersCount: entry.ordersCount,
        completedOrders: entry.completedOrders,
        cancelledOrders: entry.cancelledOrders,
        totalSpent,
        averageOrderValue: entry.completedOrders > 0 ? roundCurrency(totalSpent / entry.completedOrders) : 0,
        itemsPurchased: entry.itemsPurchased,
        firstOrderAt: formatIsoDate(entry.firstOrderAt),
        lastOrderAt: formatIsoDate(entry.lastOrderAt),
      };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const totalOrders = rows.reduce((sum, row) => sum + row.ordersCount, 0);
  const totalRevenue = roundCurrency(rows.reduce((sum, row) => sum + row.totalSpent, 0));

  return {
    reportType: 'customers',
    generatedAt: new Date().toISOString(),
    filters: {
      dateFrom: dateFilter.dateFrom,
      dateTo: dateFilter.dateTo,
    },
    summary: {
      customerCount: rows.length,
      totalOrders,
      activeCustomers: rows.filter((row) => row.completedOrders > 0).length,
      returningCustomers: rows.filter((row) => row.ordersCount >= 2).length,
      totalRevenue,
    },
    rows,
  };
}

function normalizeCellValue(value: CsvValue): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

function escapeCsvValue(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function createCsv(columns: ExportColumn[], rows: Array<Record<string, CsvValue>>): string {
  const headerLine = columns.map((column) => escapeCsvValue(column.label)).join(',');
  const dataLines = rows.map((row) =>
    columns
      .map((column) => escapeCsvValue(normalizeCellValue(row[column.key])))
      .join(','),
  );

  return [headerLine, ...dataLines].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createExcelXml(sheetName: string, columns: ExportColumn[], rows: Array<Record<string, CsvValue>>): string {
  const headerCells = columns
    .map((column) => `<Cell><Data ss:Type="String">${escapeXml(column.label)}</Data></Cell>`)
    .join('');

  const dataRows = rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const rawValue = row[column.key];
          if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
            return `<Cell><Data ss:Type="Number">${rawValue}</Data></Cell>`;
          }

          return `<Cell><Data ss:Type="String">${escapeXml(normalizeCellValue(rawValue))}</Data></Cell>`;
        })
        .join('');

      return `<Row>${cells}</Row>`;
    })
    .join('');

  return `<?xml version="1.0"?>\n` +
    `<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
    `xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" ` +
    `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Worksheet ss:Name="${escapeXml(sheetName)}"><Table>` +
    `<Row>${headerCells}</Row>${dataRows}` +
    `</Table></Worksheet></Workbook>`;
}

function toReportExportShape(report: ReportPayload): {
  reportType: ReportType;
  columns: ExportColumn[];
  rows: Array<Record<string, CsvValue>>;
} {
  switch (report.reportType) {
    case 'sales': {
      const columns: ExportColumn[] = [
        { key: 'orderNumber', label: 'Order Number' },
        { key: 'createdAt', label: 'Date' },
        { key: 'customerName', label: 'Customer Name' },
        { key: 'customerEmail', label: 'Customer Email' },
        { key: 'status', label: 'Status' },
        { key: 'subtotal', label: 'Subtotal' },
        { key: 'discountTotal', label: 'Discount Total' },
        { key: 'total', label: 'Total' },
      ];
      return { reportType: report.reportType, columns, rows: report.rows };
    }

    case 'tax': {
      const columns: ExportColumn[] = [
        { key: 'orderNumber', label: 'Order Number' },
        { key: 'createdAt', label: 'Date' },
        { key: 'customerName', label: 'Customer Name' },
        { key: 'taxableAmount', label: 'Taxable Amount' },
        { key: 'taxRatePercent', label: 'Tax Rate (%)' },
        { key: 'estimatedTax', label: 'Estimated Tax' },
        { key: 'totalWithTax', label: 'Total with Tax' },
      ];
      return { reportType: report.reportType, columns, rows: report.rows };
    }

    case 'product-performance': {
      const columns: ExportColumn[] = [
        { key: 'productTitle', label: 'Product' },
        { key: 'sku', label: 'SKU' },
        { key: 'variantName', label: 'Variant' },
        { key: 'unitsSold', label: 'Units Sold' },
        { key: 'orderCount', label: 'Order Count' },
        { key: 'revenue', label: 'Revenue' },
        { key: 'averageUnitPrice', label: 'Avg Unit Price' },
      ];
      return { reportType: report.reportType, columns, rows: report.rows };
    }

    case 'inventory-valuation': {
      const columns: ExportColumn[] = [
        { key: 'productTitle', label: 'Product' },
        { key: 'sku', label: 'SKU' },
        { key: 'variantName', label: 'Variant' },
        { key: 'productStatus', label: 'Status' },
        { key: 'stock', label: 'Stock' },
        { key: 'lowStockThreshold', label: 'Low Stock Threshold' },
        { key: 'unitPrice', label: 'Unit Price' },
        { key: 'valuation', label: 'Inventory Value' },
        { key: 'lowStock', label: 'Low Stock' },
      ];
      return { reportType: report.reportType, columns, rows: report.rows };
    }

    case 'customers': {
      const columns: ExportColumn[] = [
        { key: 'customerName', label: 'Customer Name' },
        { key: 'customerEmail', label: 'Customer Email' },
        { key: 'customerPhone', label: 'Phone' },
        { key: 'customerLocation', label: 'Location' },
        { key: 'ordersCount', label: 'Orders' },
        { key: 'completedOrders', label: 'Completed Orders' },
        { key: 'cancelledOrders', label: 'Cancelled Orders' },
        { key: 'itemsPurchased', label: 'Items Purchased' },
        { key: 'totalSpent', label: 'Total Spent' },
        { key: 'averageOrderValue', label: 'Average Order Value' },
        { key: 'firstOrderAt', label: 'First Order' },
        { key: 'lastOrderAt', label: 'Last Order' },
      ];
      return { reportType: report.reportType, columns, rows: report.rows };
    }
  }
}

async function resolveReport(reportType: ReportType, ownerId: mongoose.Types.ObjectId, dateFilter: DateFilter): Promise<ReportPayload> {
  switch (reportType) {
    case 'sales':
      return buildSalesReport(ownerId, dateFilter);
    case 'tax':
      return buildTaxReport(ownerId, dateFilter);
    case 'product-performance':
      return buildProductPerformanceReport(ownerId, dateFilter);
    case 'inventory-valuation':
      return buildInventoryValuationReport(ownerId);
    case 'customers':
      return buildCustomerReport(ownerId, dateFilter);
    default:
      return buildSalesReport(ownerId, dateFilter);
  }
}

async function guardAndResolveOwner(req: express.Request, res: express.Response): Promise<mongoose.Types.ObjectId | null> {
  if (!req.userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }

  await ensureMerchantDemoData(req.userId);
  return new mongoose.Types.ObjectId(req.userId);
}

async function handleJsonReportRequest(reportType: ReportType, req: express.Request, res: express.Response) {
  try {
    const ownerId = await guardAndResolveOwner(req, res);
    if (!ownerId) {
      return;
    }

    const filterResult = resolveDateFilter(req);
    if (filterResult.error) {
      return res.status(400).json({ message: filterResult.error });
    }

    const report = await resolveReport(reportType, ownerId, filterResult.filter ?? {});
    return res.status(200).json(report);
  } catch (error) {
    console.error(`${reportType} report error:`, error);
    return res.status(500).json({ message: 'Unable to generate report' });
  }
}

reportsRouter.get('/sales', requireAuth, requireMerchant, async (req, res) => {
  await handleJsonReportRequest('sales', req, res);
});

reportsRouter.get('/tax', requireAuth, requireMerchant, async (req, res) => {
  await handleJsonReportRequest('tax', req, res);
});

reportsRouter.get('/product-performance', requireAuth, requireMerchant, async (req, res) => {
  await handleJsonReportRequest('product-performance', req, res);
});

reportsRouter.get('/inventory-valuation', requireAuth, requireMerchant, async (req, res) => {
  await handleJsonReportRequest('inventory-valuation', req, res);
});

reportsRouter.get('/customers', requireAuth, requireMerchant, async (req, res) => {
  await handleJsonReportRequest('customers', req, res);
});

reportsRouter.get('/:reportType/export', requireAuth, requireMerchant, async (req, res) => {
  try {
    const ownerId = await guardAndResolveOwner(req, res);
    if (!ownerId) {
      return;
    }

    const reportTypeRaw = String(req.params.reportType || '').trim().toLowerCase();
    if (!isReportType(reportTypeRaw)) {
      return res.status(400).json({ message: 'Invalid report type' });
    }

    const formatRaw = String(req.query.format || 'csv').trim().toLowerCase();
    if (!isExportFormat(formatRaw)) {
      return res.status(400).json({ message: 'Invalid export format. Use csv or excel.' });
    }

    const filterResult = resolveDateFilter(req);
    if (filterResult.error) {
      return res.status(400).json({ message: filterResult.error });
    }

    const report = await resolveReport(reportTypeRaw, ownerId, filterResult.filter ?? {});
    const exportShape = toReportExportShape(report);

    const timestamp = new Date().toISOString().slice(0, 10);

    if (formatRaw === 'csv') {
      const csv = createCsv(exportShape.columns, exportShape.rows);
      const filename = `${reportTypeRaw}-report-${timestamp}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(`\uFEFF${csv}`);
    }

    const excelXml = createExcelXml(reportTypeRaw, exportShape.columns, exportShape.rows);
    const filename = `${reportTypeRaw}-report-${timestamp}.xls`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(excelXml);
  } catch (error) {
    console.error('Report export error:', error);
    return res.status(500).json({ message: 'Unable to export report' });
  }
});

export default reportsRouter;
