import mongoose, { type Document, type Model, type Schema, type Types } from 'mongoose';

export const STORE_ANALYTICS_EVENT_TYPE_VALUES = [
  'store_visit',
  'product_view',
  'checkout_started',
  'order_completed',
] as const;

export type StoreAnalyticsEventType = (typeof STORE_ANALYTICS_EVENT_TYPE_VALUES)[number];

export interface StoreAnalyticsEventDocument extends Document {
  ownerId: Types.ObjectId;
  storeSlug: string;
  eventType: StoreAnalyticsEventType;
  sessionId: string;
  trafficSource: string;
  productId?: Types.ObjectId;
  sku?: string;
  customerId?: Types.ObjectId;
  orderId?: Types.ObjectId;
  orderAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const storeAnalyticsEventSchema = new mongoose.Schema<StoreAnalyticsEventDocument>(
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
      maxlength: 120,
      index: true,
    },
    eventType: {
      type: String,
      enum: STORE_ANALYTICS_EVENT_TYPE_VALUES,
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    trafficSource: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 64,
      default: 'direct',
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      index: true,
    },
    sku: {
      type: String,
      trim: true,
      maxlength: 64,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    orderAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

storeAnalyticsEventSchema.index({ ownerId: 1, createdAt: -1 });
storeAnalyticsEventSchema.index({ ownerId: 1, eventType: 1, createdAt: -1 });
storeAnalyticsEventSchema.index({ ownerId: 1, productId: 1, eventType: 1, createdAt: -1 });
storeAnalyticsEventSchema.index({ ownerId: 1, trafficSource: 1, createdAt: -1 });
storeAnalyticsEventSchema.index({ ownerId: 1, storeSlug: 1, sessionId: 1, createdAt: -1 });

const StoreAnalyticsEventModel: Model<StoreAnalyticsEventDocument> =
  (mongoose.models.StoreAnalyticsEvent as Model<StoreAnalyticsEventDocument> | undefined) ||
  mongoose.model<StoreAnalyticsEventDocument>(
    'StoreAnalyticsEvent',
    storeAnalyticsEventSchema as Schema<StoreAnalyticsEventDocument>,
  );

export default StoreAnalyticsEventModel;
