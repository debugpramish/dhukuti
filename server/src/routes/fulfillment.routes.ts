import express from 'express';
import mongoose from 'mongoose';

import OrderModel, { type OrderShipment, type ShipmentHistoryEntry } from '../models/order.model';
import StoreModel, { STORE_COURIER_VALUES, type StoreCourier } from '../models/store.model';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import { ensureMerchantDemoData, ensureMerchantStore } from '../services/merchant-data.service';
import {
  courierQuoteSchema,
  createShipmentSchema,
  updateCodTrackingSchema,
  updateShipmentStatusSchema,
  updateShippingRulesSchema,
} from '../validation/fulfillment.validation';

const fulfillmentRouter = express.Router();

type NormalizedShippingRules = {
  baseFee: number;
  freeShippingAbove: number;
  codEnabled: boolean;
  codFee: number;
  defaultCourier: StoreCourier;
  supportedCouriers: StoreCourier[];
};

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeCourier(value: string | undefined): StoreCourier {
  const normalized = String(value || '').trim().toLowerCase();
  if (STORE_COURIER_VALUES.some((entry) => entry === normalized)) {
    return normalized as StoreCourier;
  }

  return 'nepal-post';
}

function normalizeShippingRules(rules: unknown): NormalizedShippingRules {
  const source = (rules && typeof rules === 'object' ? rules : {}) as {
    baseFee?: number;
    freeShippingAbove?: number;
    codEnabled?: boolean;
    codFee?: number;
    defaultCourier?: string;
    supportedCouriers?: string[];
  };

  const supportedCouriers = Array.isArray(source.supportedCouriers)
    ? source.supportedCouriers
        .map((entry) => normalizeCourier(entry))
        .filter((entry, index, list) => list.indexOf(entry) === index)
    : [...STORE_COURIER_VALUES];

  const defaultCourier = normalizeCourier(source.defaultCourier);

  return {
    baseFee: roundCurrency(Math.max(Number(source.baseFee ?? 100), 0)),
    freeShippingAbove: roundCurrency(Math.max(Number(source.freeShippingAbove ?? 1000), 0)),
    codEnabled: Boolean(source.codEnabled ?? true),
    codFee: roundCurrency(Math.max(Number(source.codFee ?? 50), 0)),
    defaultCourier: supportedCouriers.includes(defaultCourier) ? defaultCourier : supportedCouriers[0] ?? 'nepal-post',
    supportedCouriers: supportedCouriers.length > 0 ? supportedCouriers : [...STORE_COURIER_VALUES],
  };
}

function buildTrackingNumber(courier: StoreCourier, orderNumber: string): string {
  const courierPrefix = courier
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
  const seed = Date.now().toString(36).toUpperCase();
  return `${courierPrefix}-${orderNumber}-${seed}`;
}

function buildLabelUrl(params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  courier: string;
  trackingNumber: string;
  total: number;
}): string {
  const label = [
    'DHUKUTI SHIPPING LABEL',
    `Order: ${params.orderNumber}`,
    `Customer: ${params.customerName}`,
    `Phone: ${params.customerPhone}`,
    `Address: ${params.customerLocation}`,
    `Courier: ${params.courier}`,
    `Tracking: ${params.trackingNumber}`,
    `COD/Total: ${params.total.toFixed(2)}`,
    `Generated At: ${new Date().toISOString()}`,
  ].join('\n');

  return `data:text/plain;charset=UTF-8,${encodeURIComponent(label)}`;
}

function toShipmentResponse(shipment: OrderShipment | undefined) {
  if (!shipment) {
    return null;
  }

  return {
    courier: shipment.courier,
    trackingNumber: shipment.trackingNumber,
    labelUrl: shipment.labelUrl,
    status: shipment.status,
    estimatedDeliveryAt: shipment.estimatedDeliveryAt,
    lastUpdatedAt: shipment.lastUpdatedAt,
    history: Array.isArray(shipment.history)
      ? shipment.history.map((entry) => ({
          status: entry.status,
          timestamp: entry.timestamp,
          note: entry.note,
        }))
      : [],
  };
}

function toFulfillmentOrderResponse(order: {
  _id: mongoose.Types.ObjectId;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerLocation?: string;
  total: number;
  subtotal?: number;
  status: string;
  shippingFee?: number;
  codFee?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentReference?: string;
  codStatus?: string;
  codCollectedAmount?: number;
  shipment?: OrderShipment;
  createdAt: Date;
}) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone ?? '',
    customerLocation: order.customerLocation ?? '',
    subtotal: roundCurrency(order.subtotal ?? order.total),
    shippingFee: roundCurrency(order.shippingFee ?? 0),
    codFee: roundCurrency(order.codFee ?? 0),
    total: roundCurrency(order.total),
    status: order.status,
    paymentMethod: order.paymentMethod ?? 'cod',
    paymentStatus: order.paymentStatus ?? 'pending',
    paymentReference: order.paymentReference,
    codStatus: order.codStatus ?? 'pending',
    codCollectedAmount: roundCurrency(order.codCollectedAmount ?? 0),
    shipment: toShipmentResponse(order.shipment),
    createdAt: order.createdAt,
  };
}

function appendShipmentHistory(
  existingHistory: ShipmentHistoryEntry[] | undefined,
  entry: ShipmentHistoryEntry,
): ShipmentHistoryEntry[] {
  const history = Array.isArray(existingHistory) ? existingHistory : [];
  return [...history, entry];
}

fulfillmentRouter.get('/settings', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);
    const store = await ensureMerchantStore(req.userId);
    const shippingRules = normalizeShippingRules(store.shippingRules);

    return res.status(200).json({ shippingRules });
  } catch (error) {
    console.error('Get shipping settings error:', error);
    return res.status(500).json({ message: 'Unable to load shipping settings' });
  }
});

fulfillmentRouter.put('/settings', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const parsed = updateShippingRulesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid shipping settings payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const supportedCouriers = parsed.data.supportedCouriers.filter(
      (courier, index, list) => list.indexOf(courier) === index,
    );

    const defaultCourier = supportedCouriers.includes(parsed.data.defaultCourier)
      ? parsed.data.defaultCourier
      : supportedCouriers[0] ?? 'nepal-post';

    const store = await ensureMerchantStore(req.userId);
    store.shippingRules = {
      baseFee: roundCurrency(parsed.data.baseFee),
      freeShippingAbove: roundCurrency(parsed.data.freeShippingAbove),
      codEnabled: parsed.data.codEnabled,
      codFee: roundCurrency(parsed.data.codFee),
      defaultCourier,
      supportedCouriers,
    };

    await store.save();

    return res.status(200).json({
      shippingRules: normalizeShippingRules(store.shippingRules),
    });
  } catch (error) {
    console.error('Update shipping settings error:', error);
    return res.status(500).json({ message: 'Unable to update shipping settings' });
  }
});

fulfillmentRouter.get('/orders', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);

    const orders = await OrderModel.find({ ownerId: req.userId })
      .sort({ createdAt: -1 })
      .select({
        orderNumber: 1,
        customerName: 1,
        customerEmail: 1,
        customerPhone: 1,
        customerLocation: 1,
        subtotal: 1,
        shippingFee: 1,
        codFee: 1,
        total: 1,
        status: 1,
        paymentMethod: 1,
        paymentStatus: 1,
        paymentReference: 1,
        codStatus: 1,
        codCollectedAmount: 1,
        shipment: 1,
        createdAt: 1,
      });

    return res.status(200).json({
      orders: orders.map((order) =>
        toFulfillmentOrderResponse({
          _id: order._id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          customerLocation: order.customerLocation,
          subtotal: order.subtotal,
          shippingFee: order.shippingFee,
          codFee: order.codFee,
          total: order.total,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          paymentReference: order.paymentReference,
          codStatus: order.codStatus,
          codCollectedAmount: order.codCollectedAmount,
          shipment: order.shipment,
          createdAt: order.createdAt,
        }),
      ),
    });
  } catch (error) {
    console.error('Get fulfillment orders error:', error);
    return res.status(500).json({ message: 'Unable to load fulfillment orders' });
  }
});

fulfillmentRouter.post('/orders/:orderId/shipments', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const orderId = String(req.params.orderId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const parsed = createShipmentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid shipment payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const store = await ensureMerchantStore(req.userId);
    const rules = normalizeShippingRules(store.shippingRules);

    const order = await OrderModel.findOne({ _id: orderId, ownerId: req.userId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot create shipment for a cancelled order' });
    }

    const selectedCourier = parsed.data.courier ?? rules.defaultCourier;
    if (!rules.supportedCouriers.includes(selectedCourier)) {
      return res.status(400).json({ message: 'Selected courier is not enabled in shipping rules' });
    }

    const now = new Date();
    const trackingNumber = buildTrackingNumber(selectedCourier, order.orderNumber);
    const labelUrl = buildLabelUrl({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerLocation: order.customerLocation,
      courier: selectedCourier,
      trackingNumber,
      total: order.total,
    });

    order.shipment = {
      courier: selectedCourier,
      trackingNumber,
      labelUrl,
      status: 'label_generated',
      estimatedDeliveryAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      lastUpdatedAt: now,
      history: appendShipmentHistory(order.shipment?.history, {
        status: 'label_generated',
        timestamp: now,
        note: parsed.data.note || 'Shipping label generated',
      }),
    };

    if (order.status === 'pending') {
      order.status = 'confirmed';
    }

    await order.save();

    return res.status(200).json({
      order: toFulfillmentOrderResponse({
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerLocation: order.customerLocation,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        codFee: order.codFee,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentReference: order.paymentReference,
        codStatus: order.codStatus,
        codCollectedAmount: order.codCollectedAmount,
        shipment: order.shipment,
        createdAt: order.createdAt,
      }),
    });
  } catch (error) {
    console.error('Create shipment error:', error);
    return res.status(500).json({ message: 'Unable to create shipment' });
  }
});

fulfillmentRouter.patch('/orders/:orderId/shipments/status', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const orderId = String(req.params.orderId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const parsed = updateShipmentStatusSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid shipment status payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const order = await OrderModel.findOne({ _id: orderId, ownerId: req.userId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!order.shipment || !order.shipment.trackingNumber) {
      return res.status(400).json({ message: 'Create shipment label before updating delivery status' });
    }

    const now = new Date();
    order.shipment.status = parsed.data.status;
    order.shipment.lastUpdatedAt = now;
    order.shipment.history = appendShipmentHistory(order.shipment.history, {
      status: parsed.data.status,
      timestamp: now,
      note: parsed.data.note,
    });

    if (parsed.data.status === 'delivered') {
      order.status = 'delivered';
    } else if (parsed.data.status === 'failed') {
      order.status = 'cancelled';
    } else if (
      parsed.data.status === 'picked_up' ||
      parsed.data.status === 'in_transit' ||
      parsed.data.status === 'out_for_delivery'
    ) {
      order.status = 'shipped';
    }

    await order.save();

    return res.status(200).json({
      order: toFulfillmentOrderResponse({
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerLocation: order.customerLocation,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        codFee: order.codFee,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentReference: order.paymentReference,
        codStatus: order.codStatus,
        codCollectedAmount: order.codCollectedAmount,
        shipment: order.shipment,
        createdAt: order.createdAt,
      }),
    });
  } catch (error) {
    console.error('Update shipment status error:', error);
    return res.status(500).json({ message: 'Unable to update shipment status' });
  }
});

fulfillmentRouter.patch('/orders/:orderId/cod', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const orderId = String(req.params.orderId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const parsed = updateCodTrackingSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid COD tracking payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const order = await OrderModel.findOne({ _id: orderId, ownerId: req.userId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.paymentMethod !== 'cod') {
      return res.status(400).json({ message: 'COD tracking is only available for COD orders' });
    }

    order.codStatus = parsed.data.codStatus;

    if (parsed.data.codStatus === 'collected') {
      order.codCollectedAmount = roundCurrency(parsed.data.collectedAmount ?? order.total);
      order.paymentStatus = 'paid';
      if (!order.paymentReference) {
        order.paymentReference = `COD-${order.orderNumber}-${Date.now().toString(36).toUpperCase()}`;
      }
    } else if (parsed.data.codStatus === 'failed') {
      order.codCollectedAmount = roundCurrency(parsed.data.collectedAmount ?? 0);
      order.paymentStatus = 'failed';
    } else {
      order.codCollectedAmount = roundCurrency(parsed.data.collectedAmount ?? order.codCollectedAmount ?? 0);
      order.paymentStatus = 'pending';
    }

    await order.save();

    return res.status(200).json({
      order: toFulfillmentOrderResponse({
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerLocation: order.customerLocation,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        codFee: order.codFee,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentReference: order.paymentReference,
        codStatus: order.codStatus,
        codCollectedAmount: order.codCollectedAmount,
        shipment: order.shipment,
        createdAt: order.createdAt,
      }),
    });
  } catch (error) {
    console.error('Update COD tracking error:', error);
    return res.status(500).json({ message: 'Unable to update COD tracking' });
  }
});

fulfillmentRouter.get('/couriers', requireAuth, requireMerchant, async (_req, res) => {
  return res.status(200).json({
    couriers: STORE_COURIER_VALUES.map((courier) => ({
      id: courier,
      name:
        courier === 'nepal-post'
          ? 'Nepal Post'
          : courier === 'pathao'
            ? 'Pathao Nepal'
            : 'Delivery Sathi',
      supportsCod: true,
    })),
  });
});

fulfillmentRouter.post('/couriers/quote', requireAuth, requireMerchant, async (req, res) => {
  try {
    const parsed = courierQuoteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid courier quote payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { destination, weightKg } = parsed.data;
    const weightFactor = Math.max(weightKg, 0.1);

    const quotes = STORE_COURIER_VALUES.map((courier) => {
      const base = courier === 'nepal-post' ? 85 : courier === 'pathao' ? 120 : 95;
      const speedDays = courier === 'pathao' ? 2 : courier === 'delivery-sathi' ? 3 : 4;
      const estimatedFee = roundCurrency(base + weightFactor * 22);

      return {
        courier,
        destination,
        estimatedFee,
        estimatedDays: speedDays,
      };
    });

    return res.status(200).json({ quotes });
  } catch (error) {
    console.error('Courier quote error:', error);
    return res.status(500).json({ message: 'Unable to fetch courier quotes' });
  }
});

export default fulfillmentRouter;
