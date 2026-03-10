import express from 'express';
import mongoose from 'mongoose';

import AbandonedCheckoutModel from '../models/abandoned-checkout.model';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import { ensureMerchantDemoData } from '../services/merchant-data.service';
import {
  runAutoReminderDispatch,
  sendReminderForCheckout,
} from '../services/abandoned-checkout.service';
import {
  abandonedCartAnalyticsQuerySchema,
  abandonedCartListQuerySchema,
  autoReminderRunSchema,
  sendAbandonedReminderSchema,
} from '../validation/abandoned-cart.validation';

const abandonedCartRouter = express.Router();

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toAbandonedCartResponse(checkout: {
  _id: mongoose.Types.ObjectId;
  storeSlug: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerLocation: string;
  subtotal: number;
  productDiscountTotal: number;
  couponCode?: string;
  couponDiscountTotal: number;
  discountTotal: number;
  shippingFee: number;
  codFee: number;
  total: number;
  paymentMethod: string;
  status: string;
  source: string;
  reminderCount: number;
  autoReminderCount: number;
  lastReminderSentAt?: Date;
  lastReminderStatus?: string;
  lastReminderMessage?: string;
  lastActivityAt: Date;
  recoveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    sku?: string;
    variantName?: string;
  }>;
}) {
  return {
    id: checkout._id.toString(),
    storeSlug: checkout.storeSlug,
    customerName: checkout.customerName,
    customerEmail: checkout.customerEmail,
    customerPhone: checkout.customerPhone,
    customerLocation: checkout.customerLocation,
    subtotal: roundCurrency(checkout.subtotal),
    productDiscountTotal: roundCurrency(checkout.productDiscountTotal),
    couponCode: checkout.couponCode,
    couponDiscountTotal: roundCurrency(checkout.couponDiscountTotal),
    discountTotal: roundCurrency(checkout.discountTotal),
    shippingFee: roundCurrency(checkout.shippingFee),
    codFee: roundCurrency(checkout.codFee),
    total: roundCurrency(checkout.total),
    paymentMethod: checkout.paymentMethod,
    status: checkout.status,
    source: checkout.source,
    reminderCount: checkout.reminderCount,
    autoReminderCount: checkout.autoReminderCount,
    lastReminderSentAt: checkout.lastReminderSentAt,
    lastReminderStatus: checkout.lastReminderStatus,
    lastReminderMessage: checkout.lastReminderMessage,
    lastActivityAt: checkout.lastActivityAt,
    recoveredAt: checkout.recoveredAt,
    createdAt: checkout.createdAt,
    updatedAt: checkout.updatedAt,
    items: checkout.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unitPrice: roundCurrency(item.unitPrice),
      sku: item.sku,
      variantName: item.variantName,
    })),
  };
}

abandonedCartRouter.get('/', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);

    const parsed = abandonedCartListQuerySchema.safeParse({
      status: req.query.status,
      thresholdMinutes: req.query.thresholdMinutes,
      limit: req.query.limit,
    });

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid abandoned cart query',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const thresholdDate = new Date(Date.now() - parsed.data.thresholdMinutes * 60 * 1000);
    const statusFilter =
      parsed.data.status === 'all'
        ? {}
        : parsed.data.status === 'open'
          ? {
              status: 'open',
              lastActivityAt: { $lte: thresholdDate },
            }
          : {
              status: 'recovered',
            };

    const carts = await AbandonedCheckoutModel.find({
      ownerId: req.userId,
      ...statusFilter,
    })
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .limit(parsed.data.limit);

    return res.status(200).json({
      carts: carts.map((cart) =>
        toAbandonedCartResponse({
          _id: cart._id,
          storeSlug: cart.storeSlug,
          customerName: cart.customerName,
          customerEmail: cart.customerEmail,
          customerPhone: cart.customerPhone,
          customerLocation: cart.customerLocation,
          subtotal: cart.subtotal,
          productDiscountTotal: cart.productDiscountTotal,
          couponCode: cart.couponCode,
          couponDiscountTotal: cart.couponDiscountTotal,
          discountTotal: cart.discountTotal,
          shippingFee: cart.shippingFee,
          codFee: cart.codFee,
          total: cart.total,
          paymentMethod: cart.paymentMethod,
          status: cart.status,
          source: cart.source,
          reminderCount: cart.reminderCount,
          autoReminderCount: cart.autoReminderCount,
          lastReminderSentAt: cart.lastReminderSentAt,
          lastReminderStatus: cart.lastReminderStatus,
          lastReminderMessage: cart.lastReminderMessage,
          lastActivityAt: cart.lastActivityAt,
          recoveredAt: cart.recoveredAt,
          createdAt: cart.createdAt,
          updatedAt: cart.updatedAt,
          items: cart.items,
        }),
      ),
      thresholdMinutes: parsed.data.thresholdMinutes,
    });
  } catch (error) {
    console.error('Get abandoned carts error:', error);
    return res.status(500).json({ message: 'Unable to load abandoned carts' });
  }
});

abandonedCartRouter.get('/analytics', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);

    const parsed = abandonedCartAnalyticsQuerySchema.safeParse({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      thresholdMinutes: req.query.thresholdMinutes,
    });

    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid analytics query',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const thresholdDate = new Date(Date.now() - parsed.data.thresholdMinutes * 60 * 1000);
    const createdAtFilter: Record<string, Date> = {};
    if (parsed.data.dateFrom) {
      createdAtFilter.$gte = new Date(parsed.data.dateFrom);
    }
    if (parsed.data.dateTo) {
      createdAtFilter.$lte = new Date(parsed.data.dateTo);
    }

    const matchFilter: {
      ownerId: string;
      createdAt?: Record<string, Date>;
    } = {
      ownerId: req.userId,
    };
    if (Object.keys(createdAtFilter).length > 0) {
      matchFilter.createdAt = createdAtFilter;
    }

    const [openTotals, recoveredTotals, totalCaptured, remindersTotals] = await Promise.all([
      AbandonedCheckoutModel.aggregate<{ count: number; potentialRevenue: number }>([
        {
          $match: {
            ...matchFilter,
            status: 'open',
            lastActivityAt: { $lte: thresholdDate },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            potentialRevenue: { $sum: '$total' },
          },
        },
      ]),
      AbandonedCheckoutModel.aggregate<{ count: number; recoveredRevenue: number }>([
        {
          $match: {
            ...matchFilter,
            status: 'recovered',
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            recoveredRevenue: { $sum: '$total' },
          },
        },
      ]),
      AbandonedCheckoutModel.countDocuments(matchFilter),
      AbandonedCheckoutModel.aggregate<{ remindersSent: number; autoRemindersSent: number }>([
        {
          $match: matchFilter,
        },
        {
          $group: {
            _id: null,
            remindersSent: { $sum: '$reminderCount' },
            autoRemindersSent: { $sum: '$autoReminderCount' },
          },
        },
      ]),
    ]);

    const abandonedCount = openTotals[0]?.count ?? 0;
    const recoveredCount = recoveredTotals[0]?.count ?? 0;
    const potentialRevenue = roundCurrency(openTotals[0]?.potentialRevenue ?? 0);
    const recoveredRevenue = roundCurrency(recoveredTotals[0]?.recoveredRevenue ?? 0);
    const remindersSent = remindersTotals[0]?.remindersSent ?? 0;
    const autoRemindersSent = remindersTotals[0]?.autoRemindersSent ?? 0;
    const recoveryRatePercent =
      totalCaptured > 0 ? roundCurrency(((recoveredCount ?? 0) / totalCaptured) * 100) : 0;

    return res.status(200).json({
      analytics: {
        totalCaptured,
        abandonedCount,
        recoveredCount,
        recoveryRatePercent,
        potentialRevenue,
        recoveredRevenue,
        revenueRecovered: recoveredRevenue,
        remindersSent,
        autoRemindersSent,
        thresholdMinutes: parsed.data.thresholdMinutes,
      },
    });
  } catch (error) {
    console.error('Get abandoned cart analytics error:', error);
    return res.status(500).json({ message: 'Unable to load abandoned cart analytics' });
  }
});

abandonedCartRouter.post('/:cartId/reminders/send', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const cartId = String(req.params.cartId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(cartId)) {
      return res.status(400).json({ message: 'Invalid cart id' });
    }

    const parsed = sendAbandonedReminderSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid reminder payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const cart = await AbandonedCheckoutModel.findOne({
      _id: cartId,
      ownerId: req.userId,
      status: 'open',
    });

    if (!cart) {
      return res.status(404).json({ message: 'Open abandoned cart not found' });
    }

    const reminderResult = await sendReminderForCheckout({ checkout: cart, auto: false });
    const refreshedCart = await AbandonedCheckoutModel.findById(cart._id);

    return res.status(200).json({
      reminder: reminderResult,
      cart: refreshedCart
        ? toAbandonedCartResponse({
            _id: refreshedCart._id,
            storeSlug: refreshedCart.storeSlug,
            customerName: refreshedCart.customerName,
            customerEmail: refreshedCart.customerEmail,
            customerPhone: refreshedCart.customerPhone,
            customerLocation: refreshedCart.customerLocation,
            subtotal: refreshedCart.subtotal,
            productDiscountTotal: refreshedCart.productDiscountTotal,
            couponCode: refreshedCart.couponCode,
            couponDiscountTotal: refreshedCart.couponDiscountTotal,
            discountTotal: refreshedCart.discountTotal,
            shippingFee: refreshedCart.shippingFee,
            codFee: refreshedCart.codFee,
            total: refreshedCart.total,
            paymentMethod: refreshedCart.paymentMethod,
            status: refreshedCart.status,
            source: refreshedCart.source,
            reminderCount: refreshedCart.reminderCount,
            autoReminderCount: refreshedCart.autoReminderCount,
            lastReminderSentAt: refreshedCart.lastReminderSentAt,
            lastReminderStatus: refreshedCart.lastReminderStatus,
            lastReminderMessage: refreshedCart.lastReminderMessage,
            lastActivityAt: refreshedCart.lastActivityAt,
            recoveredAt: refreshedCart.recoveredAt,
            createdAt: refreshedCart.createdAt,
            updatedAt: refreshedCart.updatedAt,
            items: refreshedCart.items,
          })
        : null,
    });
  } catch (error) {
    console.error('Send abandoned reminder error:', error);
    return res.status(500).json({ message: 'Unable to send reminder' });
  }
});

abandonedCartRouter.post('/reminders/auto', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const parsed = autoReminderRunSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid auto reminder payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await runAutoReminderDispatch({
      ownerId: req.userId,
      thresholdMinutes: parsed.data.thresholdMinutes,
      cooldownMinutes: parsed.data.cooldownMinutes,
      limit: parsed.data.limit,
    });

    return res.status(200).json({
      result,
      thresholdMinutes: parsed.data.thresholdMinutes,
      cooldownMinutes: parsed.data.cooldownMinutes,
    });
  } catch (error) {
    console.error('Run auto reminder error:', error);
    return res.status(500).json({ message: 'Unable to run auto reminders' });
  }
});

export default abandonedCartRouter;
