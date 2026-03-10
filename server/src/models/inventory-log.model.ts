import mongoose, { type Document, type Model, type Schema, type Types } from 'mongoose';

export const INVENTORY_REASON_VALUES = ['order', 'manual_adjustment', 'restock', 'correction'] as const;
export type InventoryReason = (typeof INVENTORY_REASON_VALUES)[number];

export interface InventoryLogDocument extends Document {
  ownerId: Types.ObjectId;
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  change: number;
  stockBefore: number;
  stockAfter: number;
  reason: InventoryReason;
  note?: string;
  referenceType?: string;
  referenceId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryLogSchema = new mongoose.Schema<InventoryLogDocument>(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      index: true,
    },
    change: {
      type: Number,
      required: true,
    },
    stockBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    stockAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      enum: INVENTORY_REASON_VALUES,
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 400,
    },
    referenceType: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  },
);

inventoryLogSchema.index({ ownerId: 1, createdAt: -1 });

const InventoryLogModel: Model<InventoryLogDocument> =
  (mongoose.models.InventoryLog as Model<InventoryLogDocument> | undefined) ||
  mongoose.model<InventoryLogDocument>('InventoryLog', inventoryLogSchema as Schema<InventoryLogDocument>);

export default InventoryLogModel;
