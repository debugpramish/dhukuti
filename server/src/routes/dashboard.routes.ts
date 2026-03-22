import express from 'express';
import mongoose from 'mongoose';
import OrderModel from '../models/order.model';
import ProductModel from '../models/product.model';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import { ensureMerchantDemoData } from '../services/merchant-data.service';

const dashboardRouter = express.Router();

type DashboardTrendPeriod = 'day' | 'month' | 'year';
type DashboardTrendDirection = 'up' | 'down' | 'flat';

type DashboardTrendPoint = {
  label: string;
  count: number;
  key: string;
};

type DashboardTrendBucket = {
  current: number;
  previous: number;
  changeCount: number;
  changePercent: number;
  direction: DashboardTrendDirection;
  series: DashboardTrendPoint[];
};

type PeriodDefinition = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

function startOfUtcDay(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function addUtcDays(input: Date, amount: number): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate() + amount));
}

function addUtcMonths(input: Date, amount: number): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth() + amount, 1));
}

function addUtcYears(input: Date, amount: number): Date {
  return new Date(Date.UTC(input.getUTCFullYear() + amount, 0, 1));
}

function createDayPeriodDefinitions(now: Date, points = 7): PeriodDefinition[] {
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const todayStart = startOfUtcDay(now);

  return Array.from({ length: points }, (_, index) => {
    const offset = points - index - 1;
    const periodStart = addUtcDays(todayStart, -offset);
    const periodEnd = addUtcDays(periodStart, 1);
    const year = periodStart.getUTCFullYear();
    const month = `${periodStart.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${periodStart.getUTCDate()}`.padStart(2, '0');
    const key = `${year}-${month}-${day}`;

    return {
      key,
      label: dayFormatter.format(periodStart),
      start: periodStart,
      end: periodEnd,
    };
  });
}

function createMonthPeriodDefinitions(now: Date, points = 12): PeriodDefinition[] {
  const monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  return Array.from({ length: points }, (_, index) => {
    const offset = points - index - 1;
    const periodStart = addUtcMonths(currentMonthStart, -offset);
    const periodEnd = addUtcMonths(periodStart, 1);
    const year = periodStart.getUTCFullYear();
    const month = `${periodStart.getUTCMonth() + 1}`.padStart(2, '0');
    const key = `${year}-${month}`;

    return {
      key,
      label: monthFormatter.format(periodStart),
      start: periodStart,
      end: periodEnd,
    };
  });
}

function createYearPeriodDefinitions(now: Date, points = 5): PeriodDefinition[] {
  const currentYearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  return Array.from({ length: points }, (_, index) => {
    const offset = points - index - 1;
    const periodStart = addUtcYears(currentYearStart, -offset);
    const periodEnd = addUtcYears(periodStart, 1);
    const key = `${periodStart.getUTCFullYear()}`;

    return {
      key,
      label: key,
      start: periodStart,
      end: periodEnd,
    };
  });
}

function roundToTwo(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateTrendDelta(current: number, previous: number): {
  changeCount: number;
  changePercent: number;
  direction: DashboardTrendDirection;
} {
  const changeCount = current - previous;

  if (changeCount === 0) {
    return {
      changeCount,
      changePercent: 0,
      direction: 'flat',
    };
  }

  const direction: DashboardTrendDirection = changeCount > 0 ? 'up' : 'down';

  if (previous === 0) {
    return {
      changeCount,
      changePercent: 100,
      direction,
    };
  }

  return {
    changeCount,
    changePercent: roundToTwo((changeCount / previous) * 100),
    direction,
  };
}

async function buildTrendBucket(params: {
  ownerId: mongoose.Types.ObjectId;
  periods: PeriodDefinition[];
  dateFormat: '%Y-%m-%d' | '%Y-%m' | '%Y';
  orderMatch?: Record<string, unknown>;
}): Promise<DashboardTrendBucket> {
  if (params.periods.length === 0) {
    return {
      current: 0,
      previous: 0,
      changeCount: 0,
      changePercent: 0,
      direction: 'flat',
      series: [],
    };
  }

  const firstPeriodStart = params.periods[0]?.start;
  const lastPeriodEnd = params.periods[params.periods.length - 1]?.end;

  if (!firstPeriodStart || !lastPeriodEnd) {
    return {
      current: 0,
      previous: 0,
      changeCount: 0,
      changePercent: 0,
      direction: 'flat',
      series: [],
    };
  }

  const aggregated = await OrderModel.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        ownerId: params.ownerId,
        createdAt: {
          $gte: firstPeriodStart,
          $lt: lastPeriodEnd,
        },
        ...(params.orderMatch ?? {}),
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: params.dateFormat,
            date: '$createdAt',
            timezone: 'UTC',
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const countsByKey = new Map<string, number>();
  aggregated.forEach((entry) => {
    countsByKey.set(entry._id, entry.count);
  });

  const series = params.periods.map((period) => ({
    key: period.key,
    label: period.label,
    count: countsByKey.get(period.key) ?? 0,
  }));

  const current = series[series.length - 1]?.count ?? 0;
  const previous = series[series.length - 2]?.count ?? 0;
  const delta = calculateTrendDelta(current, previous);

  return {
    current,
    previous,
    changeCount: delta.changeCount,
    changePercent: delta.changePercent,
    direction: delta.direction,
    series,
  };
}

function formatOrderSummary(order: {
  _id: mongoose.Types.ObjectId;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: Date;
}) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
  };
}

dashboardRouter.get('/summary', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);

    const ownerObjectId = new mongoose.Types.ObjectId(req.userId);

    const [totalProducts, totalOrders, revenueAggregate, recentOrders] = await Promise.all([
      ProductModel.countDocuments({ ownerId: ownerObjectId }),
      OrderModel.countDocuments({ ownerId: ownerObjectId }),
      OrderModel.aggregate<{ totalRevenue: number }>([
        {
          $match: {
            ownerId: ownerObjectId,
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
          },
        },
      ]),
      OrderModel.find({ ownerId: ownerObjectId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select({ orderNumber: 1, customerName: 1, total: 1, status: 1, createdAt: 1 }),
    ]);

    return res.status(200).json({
      totalProducts,
      totalOrders,
      totalRevenue: revenueAggregate[0]?.totalRevenue ?? 0,
      recentOrders: recentOrders.map((order) =>
        formatOrderSummary({
          _id: order._id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: order.total,
          status: order.status,
          createdAt: order.createdAt,
        }),
      ),
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return res.status(500).json({ message: 'Unable to load dashboard summary' });
  }
});

dashboardRouter.get('/order-trends', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);

    const ownerObjectId = new mongoose.Types.ObjectId(req.userId);
    const requestedProductId =
      typeof req.query.productId === 'string' && req.query.productId.trim().length > 0
        ? req.query.productId.trim()
        : null;

    let orderMatch: Record<string, unknown> | undefined;

    if (requestedProductId) {
      if (!mongoose.Types.ObjectId.isValid(requestedProductId)) {
        return res.status(400).json({ message: 'Invalid product id' });
      }

      const product = await ProductModel.findOne({
        _id: requestedProductId,
        ownerId: ownerObjectId,
      }).select({ title: 1, variants: 1 });

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const skuList = Array.isArray(product.variants)
        ? product.variants
          .map((variant) => (typeof variant.sku === 'string' ? variant.sku.trim() : ''))
          .filter((sku): sku is string => sku.length > 0)
        : [];

      const normalizedTitle = typeof product.title === 'string' ? product.title.trim() : '';
      const itemFilters: Array<Record<string, unknown>> = [];

      if (skuList.length > 0) {
        itemFilters.push({ sku: { $in: skuList } });
      }

      if (normalizedTitle.length > 0) {
        itemFilters.push({ title: normalizedTitle });
      }

      if (itemFilters.length > 0) {
        orderMatch = {
          items: {
            $elemMatch:
              itemFilters.length === 1
                ? itemFilters[0]
                : {
                  $or: itemFilters,
                },
          },
        };
      }
    }

    const now = new Date();
    const dayPeriods = createDayPeriodDefinitions(now);
    const monthPeriods = createMonthPeriodDefinitions(now);
    const yearPeriods = createYearPeriodDefinitions(now);

    const [dayTrend, monthTrend, yearTrend] = await Promise.all([
      buildTrendBucket({
        ownerId: ownerObjectId,
        periods: dayPeriods,
        dateFormat: '%Y-%m-%d',
        orderMatch,
      }),
      buildTrendBucket({
        ownerId: ownerObjectId,
        periods: monthPeriods,
        dateFormat: '%Y-%m',
        orderMatch,
      }),
      buildTrendBucket({
        ownerId: ownerObjectId,
        periods: yearPeriods,
        dateFormat: '%Y',
        orderMatch,
      }),
    ]);

    const trends: Record<DashboardTrendPeriod, DashboardTrendBucket> = {
      day: dayTrend,
      month: monthTrend,
      year: yearTrend,
    };

    return res.status(200).json({
      trends,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Dashboard order trends error:', error);
    return res.status(500).json({ message: 'Unable to load dashboard order trends' });
  }
});

export default dashboardRouter;
