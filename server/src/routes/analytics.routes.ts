import express from 'express';
import mongoose from 'mongoose';

import OrderModel from '../models/order.model';
import ProductModel from '../models/product.model';
import StoreAnalyticsEventModel from '../models/store-analytics-event.model';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import { ensureMerchantDemoData } from '../services/merchant-data.service';
import { analyticsDateRangeQuerySchema } from '../validation/analytics.validation';

const analyticsRouter = express.Router();

type DateRange = {
  dateFrom?: string;
  dateTo?: string;
  range?: {
    $gte?: Date;
    $lt?: Date;
  };
  limit: number;
};

type ProductLookup = {
  productId: string;
  title: string;
  category: string;
};

type CustomerStats = {
  key: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerLocation: string;
  totalSpent: number;
  ordersCount: number;
  firstOrderAt: Date;
  lastOrderAt: Date;
  orderMonthKeys: Set<string>;
};

const DEFAULT_ANALYTICS_RANGE_DAYS = 90;
const COHORT_RETENTION_MONTHS = 6;

const DEFAULT_COST_RATIO = (() => {
  const parsed = Number(process.env.ANALYTICS_DEFAULT_COST_RATIO ?? '0.65');
  if (!Number.isFinite(parsed)) {
    return 0.65;
  }

  return Math.min(Math.max(parsed, 0), 0.99);
})();

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDateInput(input: string | undefined): Date | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const simpleDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (simpleDateMatch) {
    const year = Number(simpleDateMatch[1]);
    const month = Number(simpleDateMatch[2]);
    const day = Number(simpleDateMatch[3]);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(utcDate.getTime()) ? null : utcDate;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveDateRange(
  input: {
    dateFrom?: string;
    dateTo?: string;
    limit: number;
  },
  options?: {
    defaultRangeDays?: number;
  },
): { dateRange?: DateRange; error?: string } {
  const defaultRangeDays = options?.defaultRangeDays ?? DEFAULT_ANALYTICS_RANGE_DAYS;
  const now = new Date();
  const defaultFrom = new Date(now.getTime());
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - defaultRangeDays);
  defaultFrom.setUTCHours(0, 0, 0, 0);

  const from = parseDateInput(input.dateFrom) ?? defaultFrom;
  const to = parseDateInput(input.dateTo) ?? now;

  if (input.dateFrom && !parseDateInput(input.dateFrom)) {
    return { error: 'Invalid dateFrom query parameter' };
  }

  if (input.dateTo && !parseDateInput(input.dateTo)) {
    return { error: 'Invalid dateTo query parameter' };
  }

  if (from.getTime() > to.getTime()) {
    return { error: 'dateFrom must be earlier than or equal to dateTo' };
  }

  const range: DateRange['range'] = {
    $gte: from,
    $lt: new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1)),
  };

  return {
    dateRange: {
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: to.toISOString().slice(0, 10),
      range,
      limit: input.limit,
    },
  };
}

function normalizeTrafficSource(value: string | null | undefined): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'direct';
}

function toMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function monthKeyToLabel(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const date = new Date(Date.UTC(year, Math.max(month - 1, 0), 1));
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function monthOffset(fromKey: string, toKey: string): number {
  const [fromYearRaw, fromMonthRaw] = fromKey.split('-');
  const [toYearRaw, toMonthRaw] = toKey.split('-');
  const fromYear = Number(fromYearRaw);
  const fromMonth = Number(fromMonthRaw);
  const toYear = Number(toYearRaw);
  const toMonth = Number(toMonthRaw);

  if (!Number.isFinite(fromYear) || !Number.isFinite(fromMonth) || !Number.isFinite(toYear) || !Number.isFinite(toMonth)) {
    return -1;
  }

  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function createOrderMatch(params: {
  ownerId: mongoose.Types.ObjectId;
  dateRange?: DateRange;
}): Record<string, unknown> {
  const match: Record<string, unknown> = {
    ownerId: params.ownerId,
    status: { $ne: 'cancelled' },
  };

  if (params.dateRange?.range) {
    match.createdAt = params.dateRange.range;
  }

  return match;
}

function createLookupMaps(products: Array<{
  _id: mongoose.Types.ObjectId;
  title: string;
  category?: string;
  variants: Array<{
    sku: string;
  }>;
}>): {
  skuLookup: Map<string, ProductLookup>;
  titleLookup: Map<string, ProductLookup>;
  productMetaById: Map<string, ProductLookup>;
} {
  const skuLookup = new Map<string, ProductLookup>();
  const titleCandidates = new Map<string, ProductLookup[]>();
  const productMetaById = new Map<string, ProductLookup>();

  products.forEach((product) => {
    const productId = product._id.toString();
    const category = product.category?.trim() || 'Uncategorized';
    const lookup: ProductLookup = {
      productId,
      title: product.title,
      category,
    };

    productMetaById.set(productId, lookup);

    const titleKey = product.title.trim().toLowerCase();
    const list = titleCandidates.get(titleKey) ?? [];
    list.push(lookup);
    titleCandidates.set(titleKey, list);

    product.variants.forEach((variant) => {
      const skuKey = variant.sku.trim().toUpperCase();
      if (skuKey) {
        skuLookup.set(skuKey, lookup);
      }
    });
  });

  const titleLookup = new Map<string, ProductLookup>();
  titleCandidates.forEach((list, key) => {
    if (list.length === 1) {
      titleLookup.set(key, list[0]);
    }
  });

  return {
    skuLookup,
    titleLookup,
    productMetaById,
  };
}

function resolveItemLookup(params: {
  sku?: string;
  title: string;
  skuLookup: Map<string, ProductLookup>;
  titleLookup: Map<string, ProductLookup>;
}): ProductLookup {
  const skuKey = params.sku?.trim().toUpperCase() ?? '';
  if (skuKey) {
    const bySku = params.skuLookup.get(skuKey);
    if (bySku) {
      return bySku;
    }
  }

  const titleKey = params.title.trim().toLowerCase();
  const byTitle = params.titleLookup.get(titleKey);
  if (byTitle) {
    return byTitle;
  }

  return {
    productId: '',
    title: params.title,
    category: 'Uncategorized',
  };
}

function upsertCustomerStats(
  map: Map<string, CustomerStats>,
  order: {
    customerId?: mongoose.Types.ObjectId;
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
    customerLocation?: string;
    total: number;
    createdAt: Date;
  },
): CustomerStats {
  const key = order.customerId ? order.customerId.toString() : order.customerEmail.trim().toLowerCase();
  const existing = map.get(key);
  const orderMonthKey = toMonthKey(order.createdAt);

  if (existing) {
    existing.totalSpent = roundCurrency(existing.totalSpent + order.total);
    existing.ordersCount += 1;
    existing.firstOrderAt = existing.firstOrderAt.getTime() <= order.createdAt.getTime() ? existing.firstOrderAt : order.createdAt;
    existing.lastOrderAt = existing.lastOrderAt.getTime() >= order.createdAt.getTime() ? existing.lastOrderAt : order.createdAt;
    existing.orderMonthKeys.add(orderMonthKey);

    if (!existing.customerPhone && order.customerPhone) {
      existing.customerPhone = order.customerPhone;
    }
    if (!existing.customerLocation && order.customerLocation) {
      existing.customerLocation = order.customerLocation;
    }

    return existing;
  }

  const created: CustomerStats = {
    key,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone ?? '',
    customerLocation: order.customerLocation ?? '',
    totalSpent: roundCurrency(order.total),
    ordersCount: 1,
    firstOrderAt: order.createdAt,
    lastOrderAt: order.createdAt,
    orderMonthKeys: new Set([orderMonthKey]),
  };
  map.set(key, created);
  return created;
}

analyticsRouter.get('/sales', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);

    const parsedQuery = analyticsDateRangeQuerySchema.safeParse({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: req.query.limit,
    });

    if (!parsedQuery.success) {
      return res.status(400).json({
        message: 'Invalid sales analytics query',
        errors: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const resolvedRange = resolveDateRange(parsedQuery.data);
    if (!resolvedRange.dateRange || resolvedRange.error) {
      return res.status(400).json({ message: resolvedRange.error || 'Invalid date range' });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(req.userId);
    const [orders, products] = await Promise.all([
      OrderModel.find(createOrderMatch({ ownerId: ownerObjectId, dateRange: resolvedRange.dateRange })).sort({ createdAt: 1 }),
      ProductModel.find({ ownerId: ownerObjectId }).select({ _id: 1, title: 1, category: 1, variants: 1 }),
    ]);

    const { skuLookup, titleLookup } = createLookupMaps(
      products.map((product) => ({
        _id: product._id,
        title: product.title,
        category: product.category,
        variants: product.variants.map((variant) => ({ sku: variant.sku })),
      })),
    );

    const trendMap = new Map<string, { revenue: number; orders: number; units: number }>();
    const byProductMap = new Map<string, {
      productId: string;
      title: string;
      category: string;
      revenue: number;
      unitsSold: number;
      orderIds: Set<string>;
    }>();
    const byCategoryMap = new Map<string, { category: string; revenue: number; unitsSold: number; orderIds: Set<string> }>();
    const byTrafficSourceMap = new Map<string, { source: string; revenue: number; orders: number }>();

    let totalRevenue = 0;
    let totalOrders = 0;
    let totalUnits = 0;

    orders.forEach((order) => {
      totalRevenue = roundCurrency(totalRevenue + Number(order.total ?? 0));
      totalOrders += 1;

      const dayKey = order.createdAt.toISOString().slice(0, 10);
      const trendEntry = trendMap.get(dayKey) ?? { revenue: 0, orders: 0, units: 0 };
      trendEntry.revenue = roundCurrency(trendEntry.revenue + Number(order.total ?? 0));
      trendEntry.orders += 1;

      const source = normalizeTrafficSource(order.trafficSource);
      const sourceEntry = byTrafficSourceMap.get(source) ?? { source, revenue: 0, orders: 0 };
      sourceEntry.revenue = roundCurrency(sourceEntry.revenue + Number(order.total ?? 0));
      sourceEntry.orders += 1;
      byTrafficSourceMap.set(source, sourceEntry);

      order.items.forEach((item) => {
        const quantity = Math.max(Number(item.quantity ?? 0), 0);
        const lineRevenue = roundCurrency(Math.max(Number(item.unitPrice ?? 0), 0) * quantity);
        totalUnits += quantity;
        trendEntry.units += quantity;

        const resolvedLookup = resolveItemLookup({
          sku: item.sku,
          title: item.title,
          skuLookup,
          titleLookup,
        });
        const productKey = resolvedLookup.productId || `title:${resolvedLookup.title.trim().toLowerCase()}`;
        const productEntry =
          byProductMap.get(productKey) ??
          {
            productId: resolvedLookup.productId,
            title: resolvedLookup.title,
            category: resolvedLookup.category,
            revenue: 0,
            unitsSold: 0,
            orderIds: new Set<string>(),
          };
        productEntry.revenue = roundCurrency(productEntry.revenue + lineRevenue);
        productEntry.unitsSold += quantity;
        productEntry.orderIds.add(order._id.toString());
        byProductMap.set(productKey, productEntry);

        const categoryKey = resolvedLookup.category.trim() || 'Uncategorized';
        const categoryEntry =
          byCategoryMap.get(categoryKey) ??
          {
            category: categoryKey,
            revenue: 0,
            unitsSold: 0,
            orderIds: new Set<string>(),
          };
        categoryEntry.revenue = roundCurrency(categoryEntry.revenue + lineRevenue);
        categoryEntry.unitsSold += quantity;
        categoryEntry.orderIds.add(order._id.toString());
        byCategoryMap.set(categoryKey, categoryEntry);
      });

      trendMap.set(dayKey, trendEntry);
    });

    const revenueTrend = [...trendMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, value]) => ({
        date,
        revenue: roundCurrency(value.revenue),
        orders: value.orders,
        unitsSold: value.units,
      }));

    const revenueByProduct = [...byProductMap.values()]
      .map((entry) => ({
        productId: entry.productId || undefined,
        title: entry.title,
        category: entry.category,
        revenue: roundCurrency(entry.revenue),
        unitsSold: entry.unitsSold,
        ordersCount: entry.orderIds.size,
      }))
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, resolvedRange.dateRange.limit);

    const revenueByCategory = [...byCategoryMap.values()]
      .map((entry) => ({
        category: entry.category,
        revenue: roundCurrency(entry.revenue),
        unitsSold: entry.unitsSold,
        ordersCount: entry.orderIds.size,
      }))
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, resolvedRange.dateRange.limit);

    const revenueByTrafficSource = [...byTrafficSourceMap.values()]
      .map((entry) => ({
        source: entry.source,
        revenue: roundCurrency(entry.revenue),
        ordersCount: entry.orders,
        averageOrderValue: entry.orders > 0 ? roundCurrency(entry.revenue / entry.orders) : 0,
      }))
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, resolvedRange.dateRange.limit);

    return res.status(200).json({
      sales: {
        summary: {
          totalRevenue: roundCurrency(totalRevenue),
          totalOrders,
          totalUnitsSold: totalUnits,
          averageOrderValue: totalOrders > 0 ? roundCurrency(totalRevenue / totalOrders) : 0,
        },
        revenueTrend,
        revenueByProduct,
        revenueByCategory,
        revenueByTrafficSource,
        filters: {
          dateFrom: resolvedRange.dateRange.dateFrom,
          dateTo: resolvedRange.dateRange.dateTo,
        },
      },
    });
  } catch (error) {
    console.error('Get sales analytics error:', error);
    return res.status(500).json({ message: 'Unable to load sales analytics' });
  }
});

analyticsRouter.get('/customers', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);

    const parsedQuery = analyticsDateRangeQuerySchema.safeParse({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: req.query.limit,
    });

    if (!parsedQuery.success) {
      return res.status(400).json({
        message: 'Invalid customer analytics query',
        errors: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const resolvedRange = resolveDateRange(parsedQuery.data);
    if (!resolvedRange.dateRange || resolvedRange.error) {
      return res.status(400).json({ message: resolvedRange.error || 'Invalid date range' });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(req.userId);
    const allOrders = await OrderModel.find({
      ownerId: ownerObjectId,
      status: { $ne: 'cancelled' },
    }).sort({ createdAt: 1 });

    const dateRange = resolvedRange.dateRange.range;
    const periodOrders = allOrders.filter((order) => {
      if (!dateRange) {
        return true;
      }

      const createdAt = order.createdAt.getTime();
      const min = dateRange.$gte ? dateRange.$gte.getTime() : Number.NEGATIVE_INFINITY;
      const max = dateRange.$lt ? dateRange.$lt.getTime() : Number.POSITIVE_INFINITY;
      return createdAt >= min && createdAt < max;
    });

    const allCustomerMap = new Map<string, CustomerStats>();
    allOrders.forEach((order) => {
      upsertCustomerStats(allCustomerMap, {
        customerId: order.customerId,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerLocation: order.customerLocation,
        total: Number(order.total ?? 0),
        createdAt: order.createdAt,
      });
    });

    const activeCustomerKeys = new Set<string>();
    const geographyMap = new Map<string, { location: string; customerKeys: Set<string>; orders: number; revenue: number }>();
    periodOrders.forEach((order) => {
      const key = order.customerId ? order.customerId.toString() : order.customerEmail.trim().toLowerCase();
      activeCustomerKeys.add(key);

      const location = order.customerLocation?.trim() || 'Unknown';
      const entry =
        geographyMap.get(location) ??
        {
          location,
          customerKeys: new Set<string>(),
          orders: 0,
          revenue: 0,
        };

      entry.customerKeys.add(key);
      entry.orders += 1;
      entry.revenue = roundCurrency(entry.revenue + Number(order.total ?? 0));
      geographyMap.set(location, entry);
    });

    let newCustomers = 0;
    let returningCustomers = 0;
    activeCustomerKeys.forEach((customerKey) => {
      const customer = allCustomerMap.get(customerKey);
      if (!customer) {
        return;
      }

      const firstOrderTime = customer.firstOrderAt.getTime();
      const min = dateRange?.$gte ? dateRange.$gte.getTime() : Number.NEGATIVE_INFINITY;
      const max = dateRange?.$lt ? dateRange.$lt.getTime() : Number.POSITIVE_INFINITY;

      if (firstOrderTime >= min && firstOrderTime < max) {
        newCustomers += 1;
      } else {
        returningCustomers += 1;
      }
    });

    const ltvRows = [...allCustomerMap.values()]
      .map((entry) => ({
        customerKey: entry.key,
        customerName: entry.customerName,
        customerEmail: entry.customerEmail,
        customerPhone: entry.customerPhone,
        customerLocation: entry.customerLocation,
        totalSpent: roundCurrency(entry.totalSpent),
        ordersCount: entry.ordersCount,
        averageOrderValue: entry.ordersCount > 0 ? roundCurrency(entry.totalSpent / entry.ordersCount) : 0,
        firstOrderAt: entry.firstOrderAt.toISOString(),
        lastOrderAt: entry.lastOrderAt.toISOString(),
      }))
      .sort((left, right) => right.totalSpent - left.totalSpent)
      .slice(0, resolvedRange.dateRange.limit);

    const totalLtvRevenue = roundCurrency(
      [...allCustomerMap.values()].reduce((sum, entry) => sum + entry.totalSpent, 0),
    );
    const averageLtv =
      allCustomerMap.size > 0 ? roundCurrency(totalLtvRevenue / allCustomerMap.size) : 0;

    const cohortMap = new Map<string, { cohort: string; customers: Set<string>; retentionByOffset: Map<number, Set<string>> }>();

    allCustomerMap.forEach((customer) => {
      const cohort = toMonthKey(customer.firstOrderAt);
      const cohortEntry =
        cohortMap.get(cohort) ??
        {
          cohort,
          customers: new Set<string>(),
          retentionByOffset: new Map<number, Set<string>>(),
        };

      cohortEntry.customers.add(customer.key);

      customer.orderMonthKeys.forEach((monthKey) => {
        const offset = monthOffset(cohort, monthKey);
        if (offset < 0 || offset >= COHORT_RETENTION_MONTHS) {
          return;
        }

        const retained = cohortEntry.retentionByOffset.get(offset) ?? new Set<string>();
        retained.add(customer.key);
        cohortEntry.retentionByOffset.set(offset, retained);
      });

      cohortMap.set(cohort, cohortEntry);
    });

    const cohorts = [...cohortMap.values()]
      .sort((left, right) => right.cohort.localeCompare(left.cohort))
      .slice(0, COHORT_RETENTION_MONTHS)
      .map((entry) => ({
        cohort: entry.cohort,
        label: monthKeyToLabel(entry.cohort),
        size: entry.customers.size,
        retention: Array.from({ length: COHORT_RETENTION_MONTHS }, (_unused, index) => {
          const retained = entry.retentionByOffset.get(index)?.size ?? 0;
          return {
            monthOffset: index,
            customers: retained,
            ratePercent: entry.customers.size > 0 ? roundPercent((retained / entry.customers.size) * 100) : 0,
          };
        }),
      }));

    const geography = [...geographyMap.values()]
      .map((entry) => ({
        location: entry.location,
        customers: entry.customerKeys.size,
        orders: entry.orders,
        revenue: roundCurrency(entry.revenue),
      }))
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, resolvedRange.dateRange.limit);

    return res.status(200).json({
      customers: {
        summary: {
          activeCustomers: activeCustomerKeys.size,
          newCustomers,
          returningCustomers,
          averageLtv,
          totalLtvRevenue,
        },
        ltv: ltvRows,
        cohorts,
        geography,
        filters: {
          dateFrom: resolvedRange.dateRange.dateFrom,
          dateTo: resolvedRange.dateRange.dateTo,
        },
      },
    });
  } catch (error) {
    console.error('Get customer analytics error:', error);
    return res.status(500).json({ message: 'Unable to load customer analytics' });
  }
});

analyticsRouter.get('/products', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);

    const parsedQuery = analyticsDateRangeQuerySchema.safeParse({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: req.query.limit,
    });

    if (!parsedQuery.success) {
      return res.status(400).json({
        message: 'Invalid product analytics query',
        errors: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const resolvedRange = resolveDateRange(parsedQuery.data);
    if (!resolvedRange.dateRange || resolvedRange.error) {
      return res.status(400).json({ message: resolvedRange.error || 'Invalid date range' });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(req.userId);
    const [orders, products, viewAggregation] = await Promise.all([
      OrderModel.find(createOrderMatch({ ownerId: ownerObjectId, dateRange: resolvedRange.dateRange })).sort({ createdAt: 1 }),
      ProductModel.find({ ownerId: ownerObjectId }).select({ _id: 1, title: 1, category: 1, variants: 1 }),
      StoreAnalyticsEventModel.aggregate<{ _id: mongoose.Types.ObjectId; viewEvents: number; uniqueSessions: number }>([
        {
          $match: {
            ownerId: ownerObjectId,
            eventType: 'product_view',
            productId: { $exists: true, $ne: null },
            ...(resolvedRange.dateRange.range ? { createdAt: resolvedRange.dateRange.range } : {}),
          },
        },
        {
          $group: {
            _id: {
              productId: '$productId',
              sessionId: '$sessionId',
            },
            eventCount: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.productId',
            uniqueSessions: { $sum: 1 },
            viewEvents: { $sum: '$eventCount' },
          },
        },
      ]),
    ]);

    const { skuLookup, titleLookup, productMetaById } = createLookupMaps(
      products.map((product) => ({
        _id: product._id,
        title: product.title,
        category: product.category,
        variants: product.variants.map((variant) => ({ sku: variant.sku })),
      })),
    );

    const viewsByProductId = new Map<string, { viewEvents: number; uniqueSessions: number }>();
    viewAggregation.forEach((entry) => {
      viewsByProductId.set(entry._id.toString(), {
        viewEvents: Number(entry.viewEvents ?? 0),
        uniqueSessions: Number(entry.uniqueSessions ?? 0),
      });
    });

    const conversionMap = new Map<
      string,
      {
        productId: string;
        title: string;
        category: string;
        viewEvents: number;
        uniqueViewers: number;
        purchaseOrders: Set<string>;
        unitsSold: number;
        revenue: number;
        estimatedProfit: number;
      }
    >();

    productMetaById.forEach((meta) => {
      const views = viewsByProductId.get(meta.productId);
      conversionMap.set(meta.productId, {
        productId: meta.productId,
        title: meta.title,
        category: meta.category,
        viewEvents: Number(views?.viewEvents ?? 0),
        uniqueViewers: Number(views?.uniqueSessions ?? 0),
        purchaseOrders: new Set<string>(),
        unitsSold: 0,
        revenue: 0,
        estimatedProfit: 0,
      });
    });

    const profitBySkuMap = new Map<string, {
      sku: string;
      title: string;
      category: string;
      unitsSold: number;
      revenue: number;
      estimatedCost: number;
      estimatedProfit: number;
    }>();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const quantity = Math.max(Number(item.quantity ?? 0), 0);
        const unitPrice = Math.max(Number(item.unitPrice ?? 0), 0);
        const lineRevenue = roundCurrency(unitPrice * quantity);
        const estimatedCost = roundCurrency(unitPrice * DEFAULT_COST_RATIO * quantity);
        const estimatedProfit = roundCurrency(lineRevenue - estimatedCost);

        const resolvedLookup = resolveItemLookup({
          sku: item.sku,
          title: item.title,
          skuLookup,
          titleLookup,
        });

        const productId = resolvedLookup.productId;
        if (productId) {
          const entry = conversionMap.get(productId) ?? {
            productId,
            title: resolvedLookup.title,
            category: resolvedLookup.category,
            viewEvents: Number(viewsByProductId.get(productId)?.viewEvents ?? 0),
            uniqueViewers: Number(viewsByProductId.get(productId)?.uniqueSessions ?? 0),
            purchaseOrders: new Set<string>(),
            unitsSold: 0,
            revenue: 0,
            estimatedProfit: 0,
          };

          entry.purchaseOrders.add(order._id.toString());
          entry.unitsSold += quantity;
          entry.revenue = roundCurrency(entry.revenue + lineRevenue);
          entry.estimatedProfit = roundCurrency(entry.estimatedProfit + estimatedProfit);
          conversionMap.set(productId, entry);
        }

        const sku = item.sku?.trim() || 'NO-SKU';
        const skuKey = `${sku}::${resolvedLookup.title.trim().toLowerCase()}`;
        const skuEntry =
          profitBySkuMap.get(skuKey) ??
          {
            sku,
            title: resolvedLookup.title,
            category: resolvedLookup.category,
            unitsSold: 0,
            revenue: 0,
            estimatedCost: 0,
            estimatedProfit: 0,
          };
        skuEntry.unitsSold += quantity;
        skuEntry.revenue = roundCurrency(skuEntry.revenue + lineRevenue);
        skuEntry.estimatedCost = roundCurrency(skuEntry.estimatedCost + estimatedCost);
        skuEntry.estimatedProfit = roundCurrency(skuEntry.estimatedProfit + estimatedProfit);
        profitBySkuMap.set(skuKey, skuEntry);
      });
    });

    const conversion = [...conversionMap.values()]
      .map((entry) => {
        const purchases = entry.purchaseOrders.size;
        return {
          productId: entry.productId,
          title: entry.title,
          category: entry.category,
          viewEvents: entry.viewEvents,
          uniqueViewers: entry.uniqueViewers,
          purchaseOrders: purchases,
          unitsSold: entry.unitsSold,
          conversionRatePercent:
            entry.viewEvents > 0 ? roundPercent((purchases / entry.viewEvents) * 100) : 0,
          viewToPurchaseRatio:
            purchases > 0 ? roundPercent(entry.viewEvents / purchases) : 0,
          revenue: roundCurrency(entry.revenue),
          estimatedProfit: roundCurrency(entry.estimatedProfit),
        };
      })
      .filter((entry) => entry.viewEvents > 0 || entry.purchaseOrders > 0)
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, resolvedRange.dateRange.limit);

    const profitBySku = [...profitBySkuMap.values()]
      .map((entry) => ({
        sku: entry.sku,
        title: entry.title,
        category: entry.category,
        unitsSold: entry.unitsSold,
        revenue: roundCurrency(entry.revenue),
        estimatedCost: roundCurrency(entry.estimatedCost),
        estimatedProfit: roundCurrency(entry.estimatedProfit),
        profitMarginPercent: entry.revenue > 0 ? roundPercent((entry.estimatedProfit / entry.revenue) * 100) : 0,
      }))
      .sort((left, right) => right.estimatedProfit - left.estimatedProfit)
      .slice(0, resolvedRange.dateRange.limit);

    const totalViews = conversion.reduce((sum, entry) => sum + entry.viewEvents, 0);
    const totalPurchases = conversion.reduce((sum, entry) => sum + entry.purchaseOrders, 0);
    const totalRevenue = conversion.reduce((sum, entry) => sum + entry.revenue, 0);
    const totalEstimatedProfit = conversion.reduce((sum, entry) => sum + entry.estimatedProfit, 0);

    return res.status(200).json({
      products: {
        summary: {
          trackedProducts: conversion.length,
          viewEvents: totalViews,
          purchaseOrders: totalPurchases,
          conversionRatePercent: totalViews > 0 ? roundPercent((totalPurchases / totalViews) * 100) : 0,
          totalRevenue: roundCurrency(totalRevenue),
          totalEstimatedProfit: roundCurrency(totalEstimatedProfit),
          defaultCostRatioPercent: roundPercent(DEFAULT_COST_RATIO * 100),
        },
        conversion,
        profitBySku,
        filters: {
          dateFrom: resolvedRange.dateRange.dateFrom,
          dateTo: resolvedRange.dateRange.dateTo,
        },
      },
    });
  } catch (error) {
    console.error('Get product analytics error:', error);
    return res.status(500).json({ message: 'Unable to load product analytics' });
  }
});

export default analyticsRouter;
