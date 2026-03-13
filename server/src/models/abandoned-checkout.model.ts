import mongoose, { type Document, type Model, type Schema, type Types } from 'mongoose';

import { ORDER_PAYMENT_METHOD_VALUES, type OrderPaymentMethod } from './order.model';

export const ABANDONED_CHECKOUT_STATUS_VALUES = ['open', 'recovered', 'expired'] as const;
export type AbandonedCheckoutStatus = (typeof ABANDONED_CHECKOUT_STATUS_VALUES)[number];

export const ABANDONED_CHECKOUT_SOURCE_VALUES = ['preview', 'payment_initiated'] as const;
export type AbandonedCheckoutSource = (typeof ABANDONED_CHECKOUT_SOURCE_VALUES)[number];

export const ABANDONED_REMINDER_STATUS_VALUES = ['sent', 'failed', 'simulated'] as const;
export type AbandonedReminderStatus = (typeof ABANDONED_REMINDER_STATUS_VALUES)[number];

export interface AbandonedCheckoutItem {
  title: string;
  quantity: number;
  unitPrice: number;
  sku?: string;
  variantName?: string;
}

export interface AbandonedCheckoutDocument extends Document {
  ownerId: Types.ObjectId;
  storeSlug: string;
  customerId: Types.ObjectId;
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
  paymentMethod: OrderPaymentMethod;
  status: AbandonedCheckoutStatus;
  source: AbandonedCheckoutSource;
  lastActivityAt: Date;
  recoveredAt?: Date;
  recoveryOrderId?: Types.ObjectId;
  reminderCount: number;
  autoReminderCount: number;
  lastReminderSentAt?: Date;
  lastReminderStatus?: AbandonedReminderStatus;
  lastReminderMessage?: string;
  items: AbandonedCheckoutItem[];
  createdAt: Date;
  updatedAt: Date;
}

const abandonedCheckoutItemSchema = new mongoose.Schema<AbandonedCheckoutItem>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sku: {
      type: String,
      trim: true,
      maxlength: 64,
    },
    variantName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
  },
  {
    _id: false,
  },
);

const abandonedCheckoutSchema = new mongoose.Schema<AbandonedCheckoutDocument>(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    storeSlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 120,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    customerPhone: {
      type: String,
      trim: true,
      maxlength: 32,
      default: '',
    },
    customerLocation: {
      type: String,
      trim: true,
      maxlength: 255,
      default: '',
    },
    subtotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    productDiscountTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    couponDiscountTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    shippingFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    codFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    total: {
      type: Number,
      min: 0,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ORDER_PAYMENT_METHOD_VALUES,
      default: 'cod',
      index: true,
    },
    status: {
      type: String,
      enum: ABANDONED_CHECKOUT_STATUS_VALUES,
      default: 'open',
      index: true,
    },
    source: {
      type: String,
      enum: ABANDONED_CHECKOUT_SOURCE_VALUES,
      default: 'preview',
    },
    lastActivityAt: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    recoveredAt: {
      type: Date,
    },
    recoveryOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    reminderCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    autoReminderCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastReminderSentAt: {
      type: Date,
    },
    lastReminderStatus: {
      type: String,
      enum: ABANDONED_REMINDER_STATUS_VALUES,
    },
    lastReminderMessage: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    items: {
      type: [abandonedCheckoutItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

abandonedCheckoutSchema.index({ ownerId: 1, status: 1, lastActivityAt: -1 });
abandonedCheckoutSchema.index({ ownerId: 1, storeSlug: 1, customerId: 1, createdAt: -1 });
abandonedCheckoutSchema.index(
  { ownerId: 1, storeSlug: 1, customerId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'open',
    },
  },
);

const AbandonedCheckoutModel: Model<AbandonedCheckoutDocument> =
  (mongoose.models.AbandonedCheckout as Model<AbandonedCheckoutDocument> | undefined) ||
  mongoose.model<AbandonedCheckoutDocument>(
    'AbandonedCheckout',
    abandonedCheckoutSchema as Schema<AbandonedCheckoutDocument>,
  );

export default AbandonedCheckoutModel;
