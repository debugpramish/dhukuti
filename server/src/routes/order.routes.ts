import express from 'express';
import mongoose from 'mongoose';
import OrderModel from '../models/order.model';
import { requireAuth, requireCustomer, requireMerchant } from '../middleware/auth.middleware';
import { ensureMerchantDemoData } from '../services/merchant-data.service';
import { updateOrderStatusSchema } from '../validation/order.validation';

const orderRouter = express.Router();

function toShipmentResponse(shipment: {
  courier?: string;
  trackingNumber?: string;
  labelUrl?: string;
  status?: string;
  estimatedDeliveryAt?: Date;
  lastUpdatedAt?: Date;
  history?: Array<{
    status: string;
    timestamp: Date;
    note?: string;
  }>;
} | null | undefined) {
  if (!shipment) {
    return null;
  }

  return {
    courier: shipment.courier ?? '',
    trackingNumber: shipment.trackingNumber ?? '',
    labelUrl: shipment.labelUrl ?? '',
    status: shipment.status ?? 'pending',
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

function toOrderResponse(order: {
  _id: mongoose.Types.ObjectId;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerLocation?: string;
  subtotal?: number;
  productDiscountTotal?: number;
  couponCode?: string;
  couponDiscountTotal?: number;
  discountTotal?: number;
  shippingFee?: number;
  codFee?: number;
  total: number;
  status: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentReference?: string;
  codStatus?: string;
  codCollectedAmount?: number;
  shipment?: {
    courier?: string;
    trackingNumber?: string;
    labelUrl?: string;
    status?: string;
    estimatedDeliveryAt?: Date;
    lastUpdatedAt?: Date;
    history?: Array<{
      status: string;
      timestamp: Date;
      note?: string;
    }>;
  };
  createdAt: Date;
  items: Array<{
    _id: mongoose.Types.ObjectId;
    title: string;
    quantity: number;
    unitPrice: number;
    sku?: string;
    variantName?: string;
  }>;
}) {
  const subtotal = order.subtotal ?? order.total;
  const productDiscountTotal = order.productDiscountTotal ?? 0;
  const couponDiscountTotal = order.couponDiscountTotal ?? 0;
  const discountTotal = order.discountTotal ?? productDiscountTotal + couponDiscountTotal;

  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone ?? '',
    customerLocation: order.customerLocation ?? '',
    subtotal,
    productDiscountTotal,
    couponCode: order.couponCode,
    couponDiscountTotal,
    discountTotal,
    shippingFee: Number(order.shippingFee ?? 0),
    codFee: Number(order.codFee ?? 0),
    total: order.total,
    status: order.status,
    paymentMethod: order.paymentMethod ?? 'cod',
    paymentStatus: order.paymentStatus ?? 'pending',
    paymentReference: order.paymentReference,
    codStatus: order.codStatus ?? 'pending',
    codCollectedAmount: Number(order.codCollectedAmount ?? 0),
    shipment: toShipmentResponse(order.shipment),
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item._id.toString(),
      title: item.title,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      sku: item.sku,
      variantName: item.variantName,
    })),
  };
}

orderRouter.get('/customer', requireAuth, requireCustomer, async (req, res) => {
  try {
    if (!req.customerId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const orders = await OrderModel.find({ customerId: req.customerId }).sort({ createdAt: -1 });

    return res.status(200).json({
      orders: orders.map((order) =>
        toOrderResponse({
          _id: order._id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          customerLocation: order.customerLocation,
          subtotal: order.subtotal,
          productDiscountTotal: order.productDiscountTotal,
          couponCode: order.couponCode,
          couponDiscountTotal: order.couponDiscountTotal,
          discountTotal: order.discountTotal,
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
          items: order.items as Array<{
            _id: mongoose.Types.ObjectId;
            title: string;
            quantity: number;
            unitPrice: number;
            sku?: string;
            variantName?: string;
          }>,
        }),
      ),
    });
  } catch (error) {
    console.error('Get customer orders error:', error);
    return res.status(500).json({ message: 'Unable to load customer orders' });
  }
});

orderRouter.get('/', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.merchantId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.merchantId);

    const orders = await OrderModel.find({ ownerId: req.merchantId }).sort({ createdAt: -1 });

    return res.status(200).json({
      orders: orders.map((order) =>
        toOrderResponse({
          _id: order._id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          customerLocation: order.customerLocation,
          subtotal: order.subtotal,
          productDiscountTotal: order.productDiscountTotal,
          couponCode: order.couponCode,
          couponDiscountTotal: order.couponDiscountTotal,
          discountTotal: order.discountTotal,
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
          items: order.items as Array<{
            _id: mongoose.Types.ObjectId;
            title: string;
            quantity: number;
            unitPrice: number;
            sku?: string;
            variantName?: string;
          }>,
        }),
      ),
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return res.status(500).json({ message: 'Unable to load orders' });
  }
});

orderRouter.get('/:orderId', requireAuth, async (req, res) => {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rawOrderId = req.params.orderId;
    if (typeof rawOrderId !== 'string' || !mongoose.Types.ObjectId.isValid(rawOrderId)) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const isCustomer = req.authRole === 'customer';
    const query = isCustomer
      ? { _id: rawOrderId, customerId: req.customerId ?? req.authUserId }
      : { _id: rawOrderId, ownerId: req.merchantId ?? req.authUserId };

    const order = await OrderModel.findOne(query);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.status(200).json({
      order: toOrderResponse({
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerLocation: order.customerLocation,
        subtotal: order.subtotal,
        productDiscountTotal: order.productDiscountTotal,
        couponCode: order.couponCode,
        couponDiscountTotal: order.couponDiscountTotal,
        discountTotal: order.discountTotal,
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
        items: order.items as Array<{
          _id: mongoose.Types.ObjectId;
          title: string;
          quantity: number;
          unitPrice: number;
          sku?: string;
          variantName?: string;
        }>,
      }),
    });
  } catch (error) {
    console.error('Get order by id error:', error);
    return res.status(500).json({ message: 'Unable to load order details' });
  }
});

orderRouter.patch('/:orderId/status', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.merchantId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rawOrderId = req.params.orderId;
    if (typeof rawOrderId !== 'string') {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const orderId = rawOrderId;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid order status payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const order = await OrderModel.findOne({ _id: orderId, ownerId: req.merchantId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = parsed.data.status;
    await order.save();

    return res.status(200).json({
      order: toOrderResponse({
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerLocation: order.customerLocation,
        subtotal: order.subtotal,
        productDiscountTotal: order.productDiscountTotal,
        couponCode: order.couponCode,
        couponDiscountTotal: order.couponDiscountTotal,
        discountTotal: order.discountTotal,
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
        items: order.items as Array<{
          _id: mongoose.Types.ObjectId;
          title: string;
          quantity: number;
          unitPrice: number;
          sku?: string;
          variantName?: string;
        }>,
      }),
    });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({ message: 'Unable to update order status' });
  }
});

export default orderRouter;
