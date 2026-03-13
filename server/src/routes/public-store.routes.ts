import express from 'express';
import StoreModel, { STORE_COURIER_VALUES } from '../models/store.model';
import ProductModel from '../models/product.model';
import OrderModel from '../models/order.model';
import InventoryLogModel from '../models/inventory-log.model';
import StoreAnalyticsEventModel from '../models/store-analytics-event.model';
import CustomerModel from '../models/customer.model';
import CouponModel, { type CouponType } from '../models/coupon.model';
import StoreContactMessageModel from '../models/store-contact.model';
import { requireAuth, requireCustomer } from '../middleware/auth.middleware';
import { resolveStore } from '../middleware/resolveStore.middleware';
import {
  markAbandonedCheckoutRecovered,
  recordAbandonedCheckout,
} from '../services/abandoned-checkout.service';
import { trackStoreAnalyticsEventsSchema } from '../validation/analytics.validation';
import { createStoreContactMessageSchema } from '../validation/store-contact.validation';
import { createPublicOrderSchema, type CreatePublicOrderInput } from '../validation/public-order.validation';

const publicStoreRouter = express.Router();

function toStoreResponse(store: {
  slug: string;
  name: string;
  description: string;
  phone: string;
  address: string;
  logoUrl?: string;
  shippingRules?: {
    baseFee?: number;
    freeShippingAbove?: number;
    codEnabled?: boolean;
    codFee?: number;
    defaultCourier?: string;
    supportedCouriers?: string[];
  };
}) {
  const shippingRules = {
    baseFee: roundCurrency(Math.max(Number(store.shippingRules?.baseFee ?? 100), 0)),
    freeShippingAbove: roundCurrency(Math.max(Number(store.shippingRules?.freeShippingAbove ?? 1000), 0)),
    codEnabled: Boolean(store.shippingRules?.codEnabled ?? true),
    codFee: roundCurrency(Math.max(Number(store.shippingRules?.codFee ?? 50), 0)),
    defaultCourier: store.shippingRules?.defaultCourier ?? 'nepal-post',
    supportedCouriers:
      Array.isArray(store.shippingRules?.supportedCouriers) && store.shippingRules.supportedCouriers.length > 0
        ? store.shippingRules.supportedCouriers
        : [...STORE_COURIER_VALUES],
  };

  return {
    slug: store.slug,
    name: store.name,
    description: store.description,
    phone: store.phone,
    address: store.address,
    logoUrl: store.logoUrl,
    shippingRules,
  };
}

function toProductResponse(product: {
  _id: { toString: () => string };
  title: string;
  description?: string;
  category?: string;
  price: number;
  discountType: string;
  discountValue: number;
  imageUrl: string;
  status: string;
  isFeatured: boolean;
  isTrending: boolean;
  isBestSeller: boolean;
  variants?: Array<{
    _id: { toString: () => string };
    sku: string;
    name: string;
    stock: number;
    isDefault: boolean;
  }>;
}) {
  const discountType = normalizeProductDiscountType(product.discountType);
  const discountValue = Number(product.discountValue ?? 0);
  const discountedPrice = calculateDiscountedPrice(product.price, discountType, discountValue);
  const discountAmount = roundCurrency(Math.max(product.price - discountedPrice, 0));
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const stock = variants.reduce((sum, variant) => sum + Math.max(Number(variant.stock ?? 0), 0), 0);
  const availability = stock > 0 ? 'in_stock' : 'out_of_stock';

  return {
    id: product._id.toString(),
    slug: product._id.toString(),
    title: product.title,
    description: product.description?.trim() ?? '',
    category: product.category?.trim() || 'Uncategorized',
    price: product.price,
    discountType,
    discountValue,
    discountedPrice,
    discountAmount,
    hasDiscount: discountAmount > 0,
    imageUrl: product.imageUrl,
    status: product.status,
    isFeatured: product.isFeatured,
    isTrending: product.isTrending,
    stock,
    availability,
    isBestSeller: product.isBestSeller,
    rating: {
      average: 0,
      count: 0,
    },
    reviews: [],
    tags: [],
    variants: variants.map((variant) => ({
      id: variant._id.toString(),
      name: 'Option',
      value: variant.name,
      sku: variant.sku,
      stock: Math.max(Number(variant.stock ?? 0), 0),
      isDefault: Boolean(variant.isDefault),
    })),
  };
}

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeProductDiscountType(discountType: string): 'none' | 'percentage' | 'fixed' {
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeStoreSlugFragment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const PUBLIC_PAGE_CONTENT: Record<
  string,
  {
    title: string;
    seoTitle: string;
    seoDescription: string;
    body: string;
  }
> = {
  'shipping-policy': {
    title: 'Shipping Policy',
    seoTitle: 'Shipping Policy',
    seoDescription: 'Shipping timelines, processing windows, and fulfillment policy details.',
    body:
      'Orders are packed within one business day. Standard delivery usually takes 3 to 7 business days depending on destination. Tracking updates are shared once the courier scans the package.',
  },
  'return-policy': {
    title: 'Return Policy',
    seoTitle: 'Returns & Exchanges',
    seoDescription: 'Policy for returns, exchanges, and refund handling.',
    body:
      'Unused products can be returned within 7 days of delivery in original packaging. Refunds are processed after return inspection and are generally completed within 3 to 5 business days.',
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    seoTitle: 'Privacy Policy',
    seoDescription: 'How customer data is used and protected on this storefront.',
    body:
      'We collect only the information required for order processing, shipping, and support. Payments are handled by secure providers, and sensitive payment details are not stored on this storefront.',
  },
};

function calculateCouponDiscount(params: {
  subtotalAfterProductDiscount: number;
  couponType: CouponType;
  couponValue: number;
  maxDiscountAmount?: number;
}): number {
  if (params.subtotalAfterProductDiscount <= 0) {
    return 0;
  }

  let discount = 0;
  if (params.couponType === 'percentage') {
    const percentage = Math.min(Math.max(params.couponValue, 0), 100);
    discount = (params.subtotalAfterProductDiscount * percentage) / 100;

    if (typeof params.maxDiscountAmount === 'number') {
      discount = Math.min(discount, Math.max(params.maxDiscountAmount, 0));
    }
  } else {
    discount = Math.max(params.couponValue, 0);
  }

  return roundCurrency(Math.min(params.subtotalAfterProductDiscount, Math.max(discount, 0)));
}

function normalizeTrafficSource(input: unknown): string {
  const normalized = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'direct';
}

function parseTrackingSessionId(input: unknown): string {
  const sessionId = typeof input === 'string' ? input.trim() : '';
  if (!sessionId) {
    return '';
  }

  if (!/^[A-Za-z0-9-]{8,120}$/.test(sessionId)) {
    return '';
  }

  return sessionId;
}

function resolveTrackingContext(req: express.Request, body: { trafficSource?: unknown; sessionId?: unknown }) {
  const headerSource = typeof req.headers['x-traffic-source'] === 'string' ? req.headers['x-traffic-source'] : '';
  const querySource = typeof req.query.utm_source === 'string' ? req.query.utm_source : '';
  const trafficSource = normalizeTrafficSource(body.trafficSource || headerSource || querySource);
  const sessionId = parseTrackingSessionId(body.sessionId) || parseTrackingSessionId(req.headers['x-store-session-id']);

  return {
    trafficSource,
    sessionId,
  };
}

type DummyPaymentProvider = 'esewa' | 'khalti';
type DummyPaymentSessionStatus = 'initiated' | 'verified';
type DummyPaymentSession = {
  id: string;
  provider: DummyPaymentProvider;
  slug: string;
  ownerId: string;
  customerId: string;
  amount: number;
  createdAt: number;
  expiresAt: number;
  status: DummyPaymentSessionStatus;
  paymentReference?: string;
};

const PAYMENT_SESSION_TTL_MS = 15 * 60 * 1000;
const paymentSessions = new Map<string, DummyPaymentSession>();

function normalizeDummyPaymentProvider(value: string): DummyPaymentProvider | null {
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'esewa' || normalizedValue === 'khalti') {
    return normalizedValue;
  }

  return null;
}

function parsePaymentSessionId(value: unknown): string {
  const sessionId = typeof value === 'string' ? value.trim() : '';
  if (!sessionId) {
    return '';
  }

  if (!/^[A-Z0-9-]{8,120}$/i.test(sessionId)) {
    return '';
  }

  return sessionId;
}

function cleanupExpiredPaymentSessions() {
  const now = Date.now();
  for (const [sessionId, session] of paymentSessions.entries()) {
    if (session.expiresAt <= now) {
      paymentSessions.delete(sessionId);
    }
  }
}

function buildPaymentSessionId(provider: DummyPaymentProvider): string {
  const prefix = provider === 'esewa' ? 'ESEWA' : 'KHALTI';
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${randomPart}`;
}

function buildDummyPaymentReference(provider: DummyPaymentProvider): string {
  const prefix = provider === 'esewa' ? 'ESW' : 'KHL';
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-PAY-${timestamp}-${randomPart}`;
}

function isSameRoundedAmount(left: number, right: number): boolean {
  return Math.abs(roundCurrency(left) - roundCurrency(right)) <= 0.01;
}

function createDummyPaymentSession(params: {
  provider: DummyPaymentProvider;
  slug: string;
  ownerId: string;
  customerId: string;
  amount: number;
}): DummyPaymentSession {
  cleanupExpiredPaymentSessions();

  const createdAt = Date.now();
  const session: DummyPaymentSession = {
    id: buildPaymentSessionId(params.provider),
    provider: params.provider,
    slug: params.slug,
    ownerId: params.ownerId,
    customerId: params.customerId,
    amount: roundCurrency(Math.max(params.amount, 0)),
    createdAt,
    expiresAt: createdAt + PAYMENT_SESSION_TTL_MS,
    status: 'initiated',
  };

  paymentSessions.set(session.id, session);
  return session;
}

function getValidPaymentSession(paymentSessionId: string): DummyPaymentSession | null {
  cleanupExpiredPaymentSessions();

  const session = paymentSessions.get(paymentSessionId);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    paymentSessions.delete(paymentSessionId);
    return null;
  }

  return session;
}

function verifyDummyPaymentSession(params: {
  paymentSessionId: string;
  slug: string;
  ownerId: string;
  customerId: string;
}): DummyPaymentSession | null {
  const session = getValidPaymentSession(params.paymentSessionId);
  if (!session) {
    return null;
  }

  if (
    session.slug !== params.slug ||
    session.ownerId !== params.ownerId ||
    session.customerId !== params.customerId
  ) {
    return null;
  }

  if (session.status !== 'verified') {
    session.status = 'verified';
    session.paymentReference = buildDummyPaymentReference(session.provider);
    paymentSessions.set(session.id, session);
  }

  return session;
}

function getVerifiedPaymentSessionForOrder(params: {
  paymentSessionId: string;
  paymentMethod: 'esewa' | 'khalti';
  slug: string;
  ownerId: string;
  customerId: string;
  amount: number;
}): DummyPaymentSession | null {
  const session = getValidPaymentSession(params.paymentSessionId);
  if (!session || session.status !== 'verified') {
    return null;
  }

  if (
    session.provider !== params.paymentMethod ||
    session.slug !== params.slug ||
    session.ownerId !== params.ownerId ||
    session.customerId !== params.customerId
  ) {
    return null;
  }

  if (!isSameRoundedAmount(session.amount, params.amount)) {
    return null;
  }

  return session;
}

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
  _id: { toString: () => string };
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerLocation?: string;
  trafficSource?: string;
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
    _id: { toString: () => string };
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
    trafficSource: normalizeTrafficSource(order.trafficSource),
    subtotal,
    productDiscountTotal,
    couponCode: order.couponCode,
    couponDiscountTotal,
    discountTotal,
    shippingFee: roundCurrency(order.shippingFee ?? 0),
    codFee: roundCurrency(order.codFee ?? 0),
    total: order.total,
    status: order.status,
    paymentMethod: order.paymentMethod ?? 'cod',
    paymentStatus: order.paymentStatus ?? 'pending',
    paymentReference: order.paymentReference,
    codStatus: order.codStatus ?? 'pending',
    codCollectedAmount: roundCurrency(order.codCollectedAmount ?? 0),
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

function buildOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${timestamp}-${randomPart}`;
}

async function createOrderWithUniqueNumber(params: {
  ownerId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerLocation: string;
  trafficSource: string;
  subtotal: number;
  productDiscountTotal: number;
  couponCode?: string;
  couponDiscountTotal: number;
  discountTotal: number;
  shippingFee: number;
  codFee: number;
  total: number;
  paymentMethod: 'cod' | 'esewa' | 'khalti';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentReference?: string;
  codStatus: 'pending' | 'collected' | 'failed' | 'not_applicable';
  codCollectedAmount: number;
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    sku?: string;
    variantName?: string;
  }>;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = buildOrderNumber();

    try {
      const order = await OrderModel.create({
        ownerId: params.ownerId,
        customerId: params.customerId,
        orderedByRole: 'customer',
        orderNumber,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
        customerLocation: params.customerLocation,
        trafficSource: normalizeTrafficSource(params.trafficSource),
        subtotal: params.subtotal,
        productDiscountTotal: params.productDiscountTotal,
        couponCode: params.couponCode,
        couponDiscountTotal: params.couponDiscountTotal,
        discountTotal: params.discountTotal,
        shippingFee: params.shippingFee,
        codFee: params.codFee,
        total: params.total,
        status: 'pending',
        paymentMethod: params.paymentMethod,
        paymentStatus: params.paymentStatus,
        paymentReference: params.paymentReference,
        codStatus: params.codStatus,
        codCollectedAmount: params.codCollectedAmount,
        items: params.items,
      });

      return order;
    } catch (error) {
      const errorCode = (error as { code?: number }).code;
      if (errorCode === 11000) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unable to generate a unique order number');
}

class CheckoutError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'CheckoutError';
    this.statusCode = statusCode;
  }
}

type CheckoutItemInput = CreatePublicOrderInput['items'][number];

type CheckoutQuote = {
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    sku?: string;
    variantName?: string;
  }>;
  subtotal: number;
  productDiscountTotal: number;
  couponCode?: string;
  couponDiscountTotal: number;
  discountTotal: number;
  shippingFee: number;
  codFee: number;
  payableSubtotal: number;
  paymentMethod: 'cod' | 'esewa' | 'khalti';
  total: number;
  appliedCouponId: string | null;
  stockAdjustments: Array<{
    productId: string;
    variantId: string;
    sku: string;
    quantity: number;
    stockBefore: number;
    stockAfter: number;
  }>;
};

type NormalizedShippingRules = {
  baseFee: number;
  freeShippingAbove: number;
  codEnabled: boolean;
  codFee: number;
  defaultCourier: string;
  supportedCouriers: string[];
};

function normalizeShippingRules(rules: {
  baseFee?: number;
  freeShippingAbove?: number;
  codEnabled?: boolean;
  codFee?: number;
  defaultCourier?: string;
  supportedCouriers?: string[];
}): NormalizedShippingRules {
  return {
    baseFee: roundCurrency(Math.max(Number(rules.baseFee ?? 100), 0)),
    freeShippingAbove: roundCurrency(Math.max(Number(rules.freeShippingAbove ?? 1000), 0)),
    codEnabled: Boolean(rules.codEnabled ?? true),
    codFee: roundCurrency(Math.max(Number(rules.codFee ?? 50), 0)),
    defaultCourier: rules.defaultCourier ?? 'nepal-post',
    supportedCouriers:
      Array.isArray(rules.supportedCouriers) && rules.supportedCouriers.length > 0
        ? rules.supportedCouriers
        : [...STORE_COURIER_VALUES],
  };
}

async function buildCheckoutQuote(params: {
  ownerId: string;
  items: CheckoutItemInput[];
  couponCode?: string;
  paymentMethod: 'cod' | 'esewa' | 'khalti';
  shippingRules: NormalizedShippingRules;
}): Promise<CheckoutQuote> {
  const quantityByProductId = new Map<string, number>();
  for (const item of params.items) {
    const currentQuantity = quantityByProductId.get(item.productId) ?? 0;
    quantityByProductId.set(item.productId, Math.min(currentQuantity + item.quantity, 99));
  }

  const productIds = [...quantityByProductId.keys()];
  const products = await ProductModel.find({
    _id: { $in: productIds },
    ownerId: params.ownerId,
    status: 'active',
  }).select({ _id: 1, title: 1, price: 1, discountType: 1, discountValue: 1, variants: 1 });

  if (products.length !== productIds.length) {
    throw new CheckoutError(400, 'One or more products are unavailable for checkout');
  }

  const productMap = new Map<string, (typeof products)[number]>();
  products.forEach((product) => {
    productMap.set(product._id.toString(), product);
  });

  const variantQuantityMap = new Map<string, number>();
  const variantInfoMap = new Map<
    string,
    {
      product: (typeof products)[number];
      variant: (typeof products)[number]['variants'][number];
    }
  >();

  for (const item of params.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new CheckoutError(400, 'One or more products are unavailable for checkout');
    }

    const targetVariantId = item.variantId?.trim() ?? '';
    const targetSku = item.sku?.trim().toUpperCase() ?? '';

    const variant =
      (targetVariantId
        ? product.variants.find((entry) => entry._id.toString() === targetVariantId)
        : undefined) ??
      (targetSku
        ? product.variants.find((entry) => entry.sku.toUpperCase() === targetSku)
        : undefined) ??
      product.variants.find((entry) => entry.isDefault) ??
      product.variants[0];

    if (!variant) {
      throw new CheckoutError(400, `No inventory variant available for ${product.title}`);
    }

    const variantKey = `${product._id.toString()}::${variant._id.toString()}`;
    const currentQuantity = variantQuantityMap.get(variantKey) ?? 0;
    variantQuantityMap.set(variantKey, Math.min(currentQuantity + item.quantity, 99));
    variantInfoMap.set(variantKey, { product, variant });
  }

  const stockAdjustments: CheckoutQuote['stockAdjustments'] = [];
  let subtotal = 0;
  let subtotalAfterProductDiscount = 0;
  const orderItems: CheckoutQuote['items'] = [];

  for (const [variantKey, quantity] of variantQuantityMap.entries()) {
    const info = variantInfoMap.get(variantKey);
    if (!info) {
      continue;
    }

    const { product, variant } = info;
    const stockBefore = Number(variant.stock ?? 0);
    if (stockBefore < quantity) {
      throw new CheckoutError(400, `Insufficient stock for ${variant.sku} (${product.title})`);
    }

    const stockAfter = stockBefore - quantity;
    stockAdjustments.push({
      productId: product._id.toString(),
      variantId: variant._id.toString(),
      sku: variant.sku,
      quantity,
      stockBefore,
      stockAfter,
    });

    const baseUnitPrice = roundCurrency(Math.max(product.price, 0));
    const discountedUnitPrice = calculateDiscountedPrice(
      baseUnitPrice,
      normalizeProductDiscountType(product.discountType),
      Number(product.discountValue ?? 0),
    );

    subtotal = roundCurrency(subtotal + baseUnitPrice * quantity);
    subtotalAfterProductDiscount = roundCurrency(subtotalAfterProductDiscount + discountedUnitPrice * quantity);

    orderItems.push({
      title: product.title,
      quantity,
      unitPrice: discountedUnitPrice,
      sku: variant.sku,
      variantName: variant.name,
    });
  }

  const productDiscountTotal = roundCurrency(Math.max(subtotal - subtotalAfterProductDiscount, 0));
  const rawCouponCode = params.couponCode ? params.couponCode.trim().toUpperCase() : '';
  let couponCode: string | undefined;
  let couponDiscountTotal = 0;
  let appliedCouponId: string | null = null;

  if (rawCouponCode) {
    const coupon = await CouponModel.findOne({
      ownerId: params.ownerId,
      code: rawCouponCode,
    }).select({
      _id: 1,
      code: 1,
      type: 1,
      value: 1,
      minOrderAmount: 1,
      maxDiscountAmount: 1,
      isActive: 1,
      usageLimit: 1,
      usageCount: 1,
      expiresAt: 1,
    });

    if (!coupon || !coupon.isActive) {
      throw new CheckoutError(400, 'Invalid or inactive coupon code');
    }

    if (coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) {
      throw new CheckoutError(400, 'Coupon code has expired');
    }

    if (typeof coupon.usageLimit === 'number' && coupon.usageCount >= coupon.usageLimit) {
      throw new CheckoutError(400, 'Coupon usage limit has been reached');
    }

    if (subtotalAfterProductDiscount < coupon.minOrderAmount) {
      throw new CheckoutError(
        400,
        `Coupon requires a minimum order amount of ${coupon.minOrderAmount.toFixed(2)}`,
      );
    }

    couponCode = coupon.code;
    couponDiscountTotal = calculateCouponDiscount({
      subtotalAfterProductDiscount,
      couponType: coupon.type,
      couponValue: coupon.value,
      maxDiscountAmount: coupon.maxDiscountAmount,
    });
    appliedCouponId = coupon._id.toString();
  }

  const discountTotal = roundCurrency(productDiscountTotal + couponDiscountTotal);
  const payableSubtotal = roundCurrency(Math.max(0, subtotalAfterProductDiscount - couponDiscountTotal));
  const shippingFee =
    payableSubtotal >= params.shippingRules.freeShippingAbove ? 0 : roundCurrency(params.shippingRules.baseFee);

  if (params.paymentMethod === 'cod' && !params.shippingRules.codEnabled) {
    throw new CheckoutError(400, 'Cash on Delivery is not enabled for this store');
  }

  const codFee =
    params.paymentMethod === 'cod' && params.shippingRules.codEnabled
      ? roundCurrency(params.shippingRules.codFee)
      : 0;
  const total = roundCurrency(Math.max(0, payableSubtotal + shippingFee + codFee));

  return {
    items: orderItems,
    subtotal,
    productDiscountTotal,
    couponCode,
    couponDiscountTotal,
    discountTotal,
    shippingFee,
    codFee,
    payableSubtotal,
    paymentMethod: params.paymentMethod,
    total,
    appliedCouponId,
    stockAdjustments,
  };
}

publicStoreRouter.get('/stores', async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 20;

    const stores = await StoreModel.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select({ slug: 1, name: 1, description: 1, phone: 1, address: 1, logoUrl: 1, shippingRules: 1 });

    return res.status(200).json({
      stores: stores.map((store) =>
        toStoreResponse({
          slug: store.slug,
          name: store.name,
          description: store.description,
          phone: store.phone,
          address: store.address,
          logoUrl: store.logoUrl,
          shippingRules: store.shippingRules,
        }),
      ),
    });
  } catch (error) {
    console.error('List public stores error:', error);
    return res.status(500).json({ message: 'Unable to load stores' });
  }
});

publicStoreRouter.get('/stores/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ message: 'Invalid store slug' });
    }

    const store = await StoreModel.findOne({ slug });
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    return res.status(200).json({
      store: toStoreResponse({
        slug: store.slug,
        name: store.name,
        description: store.description,
        phone: store.phone,
        address: store.address,
        logoUrl: store.logoUrl,
        shippingRules: store.shippingRules,
      }),
    });
  } catch (error) {
    console.error('Get public store error:', error);
    return res.status(500).json({ message: 'Unable to load store information' });
  }
});

publicStoreRouter.get('/stores/:slug/products', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ message: 'Invalid store slug' });
    }

    const store = await StoreModel.findOne({ slug }).select({ _id: 1, ownerId: 1 });
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const featuredOnlyRaw = String(req.query.featured || '').toLowerCase();
    const featuredOnly = featuredOnlyRaw === 'true' || featuredOnlyRaw === '1';
    const bestSellerOnlyRaw = String(req.query.bestSeller || '').toLowerCase();
    const bestSellerOnly = bestSellerOnlyRaw === 'true' || bestSellerOnlyRaw === '1';
    const trendingOnlyRaw = String(req.query.trending || '').toLowerCase();
    const trendingOnly = trendingOnlyRaw === 'true' || trendingOnlyRaw === '1';

    const pageRaw = Number(req.query.page);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 20;
    const skip = (page - 1) * limit;

    const category = String(req.query.category || '').trim();
    const searchQuery = String(req.query.q || '').trim();
    const availability = String(req.query.availability || '').trim().toLowerCase();
    const sort = String(req.query.sort || 'newest').trim().toLowerCase();
    const minPriceRaw = Number(req.query.minPrice);
    const maxPriceRaw = Number(req.query.maxPrice);
    const hasMinPrice = Number.isFinite(minPriceRaw) && minPriceRaw >= 0;
    const hasMaxPrice = Number.isFinite(maxPriceRaw) && maxPriceRaw >= 0;

    if (availability === 'preorder') {
      return res.status(200).json({
        products: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
      });
    }

    const query: Record<string, unknown> = {
      ownerId: store.ownerId,
      status: 'active',
      ...(featuredOnly ? { isFeatured: true } : {}),
      ...(bestSellerOnly ? { isBestSeller: true } : {}),
      ...(trendingOnly ? { isTrending: true } : {}),
    };

    if (category) {
      query.category = { $regex: new RegExp(`^${escapeRegex(category)}$`, 'i') };
    }

    if (searchQuery) {
      query.$or = [
        { title: { $regex: new RegExp(escapeRegex(searchQuery), 'i') } },
        { category: { $regex: new RegExp(escapeRegex(searchQuery), 'i') } },
      ];
    }

    if (availability === 'in_stock') {
      query['variants.stock'] = { $gt: 0 };
    } else if (availability === 'out_of_stock') {
      query.$nor = [{ 'variants.stock': { $gt: 0 } }];
    }

    if (hasMinPrice || hasMaxPrice) {
      query.price = {
        ...(hasMinPrice ? { $gte: minPriceRaw } : {}),
        ...(hasMaxPrice ? { $lte: maxPriceRaw } : {}),
      };
    }

    const sortOptions: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === 'price_asc') {
      sortOptions.price = 1;
      delete sortOptions.createdAt;
    } else if (sort === 'price_desc') {
      sortOptions.price = -1;
      delete sortOptions.createdAt;
    } else if (sort === 'discount_desc') {
      sortOptions.discountValue = -1;
    } else if (sort === 'popular') {
      sortOptions.isTrending = -1;
    } else if (sort === 'best_seller') {
      sortOptions.isBestSeller = -1;
    } else if (sort === 'rating_desc') {
      sortOptions.isFeatured = -1;
    }

    const [products, total] = await Promise.all([
      ProductModel.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      ProductModel.countDocuments(query),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      products: products.map((product) =>
        toProductResponse({
          _id: product._id,
          title: product.title,
          description: '',
          category: product.category,
          price: product.price,
          discountType: product.discountType,
          discountValue: product.discountValue,
          imageUrl: product.imageUrl,
          status: product.status,
          isFeatured: product.isFeatured,
          isTrending: product.isTrending,
          isBestSeller: product.isBestSeller,
          variants: product.variants as Array<{
            _id: { toString: () => string };
            sku: string;
            name: string;
            stock: number;
            isDefault: boolean;
          }>,
        }),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Get public store products error:', error);
    return res.status(500).json({ message: 'Unable to load store products' });
  }
});

publicStoreRouter.get('/stores/:slug/products/:productSlug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ message: 'Invalid store slug' });
    }

    const rawProductSlug = String(req.params.productSlug || '').trim();
    if (!rawProductSlug) {
      return res.status(400).json({ message: 'Invalid product identifier' });
    }

    const store = await StoreModel.findOne({ slug }).select({ ownerId: 1 });
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const isObjectId = /^[a-fA-F0-9]{24}$/.test(rawProductSlug);
    const productById = isObjectId
      ? await ProductModel.findOne({
          _id: rawProductSlug,
          ownerId: store.ownerId,
          status: 'active',
        })
      : null;

    let product = productById;

    if (!product) {
      const products = await ProductModel.find({
        ownerId: store.ownerId,
        status: 'active',
      }).sort({ createdAt: -1 });

      const matching = products.find((entry) => normalizeStoreSlugFragment(entry.title) === normalizeStoreSlugFragment(rawProductSlug));
      product = matching || null;
    }

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.status(200).json({
      product: toProductResponse({
        _id: product._id,
        title: product.title,
        description: '',
        category: product.category,
        price: product.price,
        discountType: product.discountType,
        discountValue: product.discountValue,
        imageUrl: product.imageUrl,
        status: product.status,
        isFeatured: product.isFeatured,
        isTrending: product.isTrending,
        isBestSeller: product.isBestSeller,
        variants: product.variants as Array<{
          _id: { toString: () => string };
          sku: string;
          name: string;
          stock: number;
          isDefault: boolean;
        }>,
      }),
    });
  } catch (error) {
    console.error('Get public store product detail error:', error);
    return res.status(500).json({ message: 'Unable to load product details' });
  }
});

publicStoreRouter.get('/pages/:slug', async (req, res) => {
  try {
    const slug = normalizeStoreSlugFragment(String(req.params.slug || ''));
    if (!slug) {
      return res.status(400).json({ message: 'Invalid page slug' });
    }

    const page = PUBLIC_PAGE_CONTENT[slug];
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }

    return res.status(200).json({
      page: {
        slug,
        title: page.title,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        body: page.body,
      },
    });
  } catch (error) {
    console.error('Get public page error:', error);
    return res.status(500).json({ message: 'Unable to load page' });
  }
});

publicStoreRouter.post('/stores/:slug/analytics/events', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ message: 'Invalid store slug' });
    }

    const parsed = trackStoreAnalyticsEventsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid analytics events payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const store = await StoreModel.findOne({ slug }).select({ ownerId: 1, slug: 1 });
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const productIds = [...new Set(parsed.data.events.map((event) => event.productId).filter((value): value is string => Boolean(value)))];
    const validProductIdSet = new Set<string>();
    if (productIds.length > 0) {
      const products = await ProductModel.find({
        _id: { $in: productIds },
        ownerId: store.ownerId,
      }).select({ _id: 1 });
      products.forEach((product) => validProductIdSet.add(product._id.toString()));
    }

    const trafficSource = normalizeTrafficSource(parsed.data.trafficSource);
    const eventsToInsert = parsed.data.events
      .map((event) => {
        const productId = event.productId && validProductIdSet.has(event.productId)
          ? event.productId
          : undefined;

        return {
          ownerId: store.ownerId,
          storeSlug: store.slug,
          eventType: event.eventType,
          sessionId: parsed.data.sessionId,
          trafficSource,
          ...(productId ? { productId } : {}),
          ...(event.sku ? { sku: event.sku.toUpperCase() } : {}),
        };
      });

    if (eventsToInsert.length > 0) {
      await StoreAnalyticsEventModel.insertMany(eventsToInsert, { ordered: false });
    }

    return res.status(202).json({
      message: 'Analytics events accepted',
      accepted: eventsToInsert.length,
    });
  } catch (error) {
    console.error('Track store analytics events error:', error);
    return res.status(500).json({ message: 'Unable to record analytics events' });
  }
});

publicStoreRouter.post('/stores/:slug/contact', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ message: 'Invalid store slug' });
    }

    const parsed = createStoreContactMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid contact form payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const store = await StoreModel.findOne({ slug }).select({ _id: 1 });
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    await StoreContactMessageModel.create({
      storeId: store._id,
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
    });

    return res.status(201).json({ message: 'Message sent successfully' });
  } catch (error) {
    console.error('Create contact message error:', error);
    return res.status(500).json({ message: 'Unable to submit contact message' });
  }
});

publicStoreRouter.post('/stores/:slug/coupons/validate', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ message: 'Invalid store slug' });
    }

    const code = String(req.body?.code || '').trim().toUpperCase();
    const totalRaw = Number(req.body?.total);
    const total = Number.isFinite(totalRaw) && totalRaw >= 0 ? roundCurrency(totalRaw) : 0;

    if (!code) {
      return res.status(400).json({ message: 'Coupon code is required' });
    }

    const store = await StoreModel.findOne({ slug }).select({ ownerId: 1 });
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const coupon = await CouponModel.findOne({
      ownerId: store.ownerId,
      code,
    }).select({
      code: 1,
      type: 1,
      value: 1,
      minOrderAmount: 1,
      maxDiscountAmount: 1,
      isActive: 1,
      usageLimit: 1,
      usageCount: 1,
      expiresAt: 1,
    });

    if (!coupon || !coupon.isActive) {
      return res.status(200).json({
        valid: false,
        discountAmount: 0,
        message: 'Invalid or inactive coupon code',
      });
    }

    if (coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) {
      return res.status(200).json({
        valid: false,
        discountAmount: 0,
        message: 'Coupon code has expired',
      });
    }

    if (typeof coupon.usageLimit === 'number' && coupon.usageCount >= coupon.usageLimit) {
      return res.status(200).json({
        valid: false,
        discountAmount: 0,
        message: 'Coupon usage limit has been reached',
      });
    }

    if (total < coupon.minOrderAmount) {
      return res.status(200).json({
        valid: false,
        discountAmount: 0,
        message: `Coupon requires a minimum order amount of ${coupon.minOrderAmount.toFixed(2)}`,
      });
    }

    const discountAmount = calculateCouponDiscount({
      subtotalAfterProductDiscount: total,
      couponType: coupon.type,
      couponValue: coupon.value,
      maxDiscountAmount: coupon.maxDiscountAmount,
    });

    return res.status(200).json({
      valid: true,
      discountAmount,
      message: 'Coupon applied successfully',
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      },
    });
  } catch (error) {
    console.error('Validate public coupon error:', error);
    return res.status(500).json({ message: 'Unable to validate coupon' });
  }
});

publicStoreRouter.post(
  '/stores/:slug/payments/:provider/initiate',
  resolveStore,
  requireAuth,
  requireCustomer,
  async (req, res) => {
    try {
      if (!req.storeId || !req.customerId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const slug = req.storeSlug ?? String(req.params.slug || '').trim().toLowerCase();
      const provider = normalizeDummyPaymentProvider(String(req.params.provider || ''));
      if (!provider) {
        return res.status(400).json({ message: 'Unsupported payment provider' });
      }

      const parsed = createPublicOrderSchema.safeParse({
        ...req.body,
        paymentMethod: provider,
      });
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Invalid payment initiation payload',
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const store =
        req.store ??
        (await StoreModel.findById(req.storeId).select({ _id: 1, ownerId: 1, shippingRules: 1, slug: 1 }).lean());
      if (!store) {
        return res.status(404).json({ message: 'Store not found' });
      }

      const customer = await CustomerModel.findOne({ _id: req.customerId, storeId: req.storeId }).select({
        _id: 1,
        email: 1,
        name: 1,
      });
      if (!customer) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const shippingRules = normalizeShippingRules((store as typeof store)?.shippingRules ?? {});
      const trackingContext = resolveTrackingContext(req, {
        trafficSource: parsed.data.trafficSource,
        sessionId: parsed.data.sessionId,
      });
      const quote = await buildCheckoutQuote({
        ownerId: store.ownerId.toString(),
        items: parsed.data.items,
        couponCode: parsed.data.couponCode,
        paymentMethod: provider,
        shippingRules,
      });

      await StoreAnalyticsEventModel.create({
        ownerId: store.ownerId,
        storeSlug: slug,
        eventType: 'checkout_started',
        sessionId: trackingContext.sessionId || `checkout-${Date.now().toString(36)}`,
        trafficSource: trackingContext.trafficSource,
        customerId: customer._id,
        orderAmount: quote.total,
      });

      await recordAbandonedCheckout({
        ownerId: store.ownerId.toString(),
        storeSlug: slug,
        customerId: customer._id.toString(),
        customerName: parsed.data.customerName,
        customerEmail: customer.email,
        customerPhone: parsed.data.customerPhone,
        customerLocation: parsed.data.customerLocation,
        subtotal: quote.subtotal,
        productDiscountTotal: quote.productDiscountTotal,
        couponCode: quote.couponCode,
        couponDiscountTotal: quote.couponDiscountTotal,
        discountTotal: quote.discountTotal,
        shippingFee: quote.shippingFee,
        codFee: quote.codFee,
        total: quote.total,
        paymentMethod: quote.paymentMethod,
        source: 'payment_initiated',
        items: quote.items,
      });

      const paymentSession = createDummyPaymentSession({
        provider,
        slug,
        ownerId: store.ownerId.toString(),
        customerId: customer._id.toString(),
        amount: quote.total,
      });

      const gatewayPayload =
        provider === 'esewa'
          ? {
              merchantCode: 'EPAYTEST',
              transactionUuid: paymentSession.id,
              amount: paymentSession.amount,
              productServiceCharge: 0,
              productDeliveryCharge: 0,
              taxAmount: 0,
              successUrl: `/store/${slug}/catalog?payment=success`,
              failureUrl: `/store/${slug}/catalog?payment=failed`,
            }
          : {
              publicKey: 'test_public_key_khalti',
              pidx: paymentSession.id,
              amountPaisa: Math.round(paymentSession.amount * 100),
              purchaseOrderName: `Order for ${slug}`,
              purchaseOrderId: paymentSession.id,
              returnUrl: `/store/${slug}/catalog?payment=success`,
              websiteUrl: `/store/${slug}`,
            };

      return res.status(200).json({
        payment: {
          provider,
          paymentSessionId: paymentSession.id,
          status: paymentSession.status,
          amount: paymentSession.amount,
          expiresAt: new Date(paymentSession.expiresAt).toISOString(),
          gatewayPayload,
        },
        bill: {
          subtotal: quote.subtotal,
          productDiscountTotal: quote.productDiscountTotal,
          couponCode: quote.couponCode,
          couponDiscountTotal: quote.couponDiscountTotal,
          discountTotal: quote.discountTotal,
          shippingFee: quote.shippingFee,
          codFee: quote.codFee,
          paymentMethod: quote.paymentMethod,
          total: quote.total,
        },
      });
    } catch (error) {
      if (error instanceof CheckoutError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      console.error('Initiate dummy payment error:', error);
      return res.status(500).json({ message: 'Unable to initiate payment' });
    }
  },
);

publicStoreRouter.post('/stores/:slug/payments/verify', resolveStore, requireAuth, requireCustomer, async (req, res) => {
  try {
    if (!req.storeId || !req.customerId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const slug = req.storeSlug ?? String(req.params.slug || '').trim().toLowerCase();
    const paymentSessionId = parsePaymentSessionId(req.body?.paymentSessionId);
    if (!paymentSessionId) {
      return res.status(400).json({ message: 'Valid paymentSessionId is required' });
    }

    const store =
      req.store ??
      (await StoreModel.findById(req.storeId).select({ ownerId: 1, slug: 1 }).lean());
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const paymentSession = verifyDummyPaymentSession({
      paymentSessionId,
      slug,
      ownerId: store.ownerId.toString(),
      customerId: req.customerId,
    });

    if (!paymentSession) {
      return res.status(404).json({ message: 'Payment session not found or expired' });
    }

    return res.status(200).json({
      payment: {
        provider: paymentSession.provider,
        paymentSessionId: paymentSession.id,
        status: paymentSession.status,
        amount: paymentSession.amount,
        paymentReference: paymentSession.paymentReference,
        expiresAt: new Date(paymentSession.expiresAt).toISOString(),
      },
    });
  } catch (error) {
    console.error('Verify dummy payment error:', error);
    return res.status(500).json({ message: 'Unable to verify payment' });
  }
});

publicStoreRouter.post('/stores/:slug/orders/preview', resolveStore, requireAuth, requireCustomer, async (req, res) => {
  try {
    if (!req.storeId || !req.customerId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const slug = req.storeSlug ?? String(req.params.slug || '').trim().toLowerCase();
    const parsed = createPublicOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid checkout payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const store =
      req.store ??
      (await StoreModel.findById(req.storeId).select({ _id: 1, ownerId: 1, shippingRules: 1 }).lean());
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const customer = await CustomerModel.findOne({ _id: req.customerId, storeId: req.storeId }).select({
      name: 1,
      email: 1,
    });
    if (!customer) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const shippingRules = normalizeShippingRules((store as typeof store)?.shippingRules ?? {});
    const trackingContext = resolveTrackingContext(req, {
      trafficSource: parsed.data.trafficSource,
      sessionId: parsed.data.sessionId,
    });

    const quote = await buildCheckoutQuote({
      ownerId: store.ownerId.toString(),
      items: parsed.data.items,
      couponCode: parsed.data.couponCode,
      paymentMethod: parsed.data.paymentMethod,
      shippingRules,
    });

    await recordAbandonedCheckout({
      ownerId: store.ownerId.toString(),
      storeSlug: slug,
      customerId: req.customerId,
      customerName: parsed.data.customerName,
      customerEmail: customer.email,
      customerPhone: parsed.data.customerPhone,
      customerLocation: parsed.data.customerLocation,
      subtotal: quote.subtotal,
      productDiscountTotal: quote.productDiscountTotal,
      couponCode: quote.couponCode,
      couponDiscountTotal: quote.couponDiscountTotal,
      discountTotal: quote.discountTotal,
      shippingFee: quote.shippingFee,
      codFee: quote.codFee,
      total: quote.total,
      paymentMethod: quote.paymentMethod,
      source: 'preview',
      items: quote.items,
    });

    return res.status(200).json({
      bill: {
        subtotal: quote.subtotal,
        productDiscountTotal: quote.productDiscountTotal,
        couponCode: quote.couponCode,
        couponDiscountTotal: quote.couponDiscountTotal,
        discountTotal: quote.discountTotal,
        shippingFee: quote.shippingFee,
        codFee: quote.codFee,
        paymentMethod: quote.paymentMethod,
        total: quote.total,
      },
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error('Preview public order bill error:', error);
    return res.status(500).json({ message: 'Unable to preview checkout bill' });
  }
});

publicStoreRouter.post('/stores/:slug/orders', resolveStore, requireAuth, requireCustomer, async (req, res) => {
  try {
    if (!req.storeId || !req.customerId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const slug = req.storeSlug ?? String(req.params.slug || '').trim().toLowerCase();
    const parsed = createPublicOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid checkout payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const store =
      req.store ??
      (await StoreModel.findById(req.storeId).select({ _id: 1, ownerId: 1, shippingRules: 1 }).lean());
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const customer = await CustomerModel.findOne({ _id: req.customerId, storeId: req.storeId }).select({
      _id: 1,
      name: 1,
      email: 1,
    });
    if (!customer) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const shippingRules = normalizeShippingRules((store as typeof store)?.shippingRules ?? {});
    const trackingContext = resolveTrackingContext(req, {
      trafficSource: parsed.data.trafficSource,
      sessionId: parsed.data.sessionId,
    });

    const quote = await buildCheckoutQuote({
      ownerId: store.ownerId.toString(),
      items: parsed.data.items,
      couponCode: parsed.data.couponCode,
      paymentMethod: parsed.data.paymentMethod,
      shippingRules,
    });

    await StoreAnalyticsEventModel.create({
      ownerId: store.ownerId,
      storeSlug: slug,
      eventType: 'checkout_started',
      sessionId: trackingContext.sessionId || `checkout-${Date.now().toString(36)}`,
      trafficSource: trackingContext.trafficSource,
      customerId: customer._id,
      orderAmount: quote.total,
    });

    let paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' = 'pending';
    let paymentReference: string | undefined;
    let codStatus: 'pending' | 'collected' | 'failed' | 'not_applicable' =
      quote.paymentMethod === 'cod' ? 'pending' : 'not_applicable';

    if (quote.paymentMethod !== 'cod') {
      const paymentSessionId = parsePaymentSessionId(parsed.data.paymentSessionId);
      if (!paymentSessionId) {
        return res.status(400).json({
          message: `Verify ${quote.paymentMethod === 'esewa' ? 'eSewa' : 'Khalti'} payment before placing order`,
        });
      }

      const verifiedPaymentSession = getVerifiedPaymentSessionForOrder({
        paymentSessionId,
        paymentMethod: quote.paymentMethod,
        slug,
        ownerId: store.ownerId.toString(),
        customerId: customer._id.toString(),
        amount: quote.total,
      });

      if (!verifiedPaymentSession) {
        return res.status(400).json({
          message: `Complete ${quote.paymentMethod === 'esewa' ? 'eSewa' : 'Khalti'} payment before placing order`,
        });
      }

      paymentStatus = 'paid';
      paymentReference = verifiedPaymentSession.paymentReference ?? buildDummyPaymentReference(quote.paymentMethod);
      codStatus = 'not_applicable';
    }

    const order = await createOrderWithUniqueNumber({
      ownerId: store.ownerId.toString(),
      customerId: customer._id.toString(),
      customerName: parsed.data.customerName,
      customerEmail: customer.email,
      customerPhone: parsed.data.customerPhone,
      customerLocation: parsed.data.customerLocation,
      trafficSource: trackingContext.trafficSource,
      subtotal: quote.subtotal,
      productDiscountTotal: quote.productDiscountTotal,
      couponCode: quote.couponCode,
      couponDiscountTotal: quote.couponDiscountTotal,
      discountTotal: quote.discountTotal,
      shippingFee: quote.shippingFee,
      codFee: quote.codFee,
      total: quote.total,
      paymentMethod: quote.paymentMethod,
      paymentStatus,
      paymentReference,
      codStatus,
      codCollectedAmount: 0,
      items: quote.items,
    });

    await StoreAnalyticsEventModel.create({
      ownerId: store.ownerId,
      storeSlug: slug,
      eventType: 'order_completed',
      sessionId: trackingContext.sessionId || `order-${order._id.toString()}`,
      trafficSource: trackingContext.trafficSource,
      customerId: customer._id,
      orderId: order._id,
      orderAmount: quote.total,
    });

    for (const adjustment of quote.stockAdjustments) {
      await ProductModel.updateOne(
        {
          _id: adjustment.productId,
          ownerId: store.ownerId,
          'variants._id': adjustment.variantId,
        },
        {
          $set: { 'variants.$.stock': adjustment.stockAfter },
        },
      );

      await InventoryLogModel.create({
        ownerId: store.ownerId,
        productId: adjustment.productId,
        variantId: adjustment.variantId,
        sku: adjustment.sku,
        change: -adjustment.quantity,
        stockBefore: adjustment.stockBefore,
        stockAfter: adjustment.stockAfter,
        reason: 'order',
        note: `Order ${order.orderNumber}`,
        referenceType: 'order',
        referenceId: order._id,
      });
    }

    if (quote.appliedCouponId) {
      await CouponModel.updateOne(
        { _id: quote.appliedCouponId, ownerId: store.ownerId },
        { $inc: { usageCount: 1 } },
      );
    }

    await markAbandonedCheckoutRecovered({
      ownerId: store.ownerId.toString(),
      storeSlug: slug,
      customerId: customer._id.toString(),
      orderId: order._id,
    });

    if (quote.paymentMethod !== 'cod') {
      const paymentSessionId = parsePaymentSessionId(parsed.data.paymentSessionId);
      if (paymentSessionId) {
        paymentSessions.delete(paymentSessionId);
      }
    }

    return res.status(201).json({
      message: 'Order placed successfully',
      order: toOrderResponse({
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerLocation: order.customerLocation,
        trafficSource: order.trafficSource,
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
          _id: { toString: () => string };
          title: string;
          quantity: number;
          unitPrice: number;
          sku?: string;
          variantName?: string;
        }>,
      }),
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error('Create public order error:', error);
    return res.status(500).json({ message: 'Unable to place order' });
  }
});

export default publicStoreRouter;
