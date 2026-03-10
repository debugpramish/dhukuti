import mongoose, { type Document, type Model, type Schema, type Types } from 'mongoose';

export const COUPON_TYPE_VALUES = ['percentage', 'fixed'] as const;
export type CouponType = (typeof COUPON_TYPE_VALUES)[number];

export interface CouponDocument extends Document {
  ownerId: Types.ObjectId;
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new mongoose.Schema<CouponDocument>(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 40,
    },
    type: {
      type: String,
      enum: COUPON_TYPE_VALUES,
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0.01,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    usageLimit: {
      type: Number,
      min: 1,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

couponSchema.index({ ownerId: 1, code: 1 }, { unique: true });
couponSchema.index({ ownerId: 1, isActive: 1, expiresAt: 1 });

const CouponModel: Model<CouponDocument> =
  (mongoose.models.Coupon as Model<CouponDocument> | undefined) ||
  mongoose.model<CouponDocument>('Coupon', couponSchema as Schema<CouponDocument>);

export default CouponModel;
