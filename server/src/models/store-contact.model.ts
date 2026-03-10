import mongoose, { type Document, type Model, type Schema, type Types } from 'mongoose';

export interface StoreContactMessageDocument extends Document {
  storeId: Types.ObjectId;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const storeContactMessageSchema = new mongoose.Schema<StoreContactMessageDocument>(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  },
);

storeContactMessageSchema.index({ storeId: 1, createdAt: -1 });

const StoreContactMessageModel: Model<StoreContactMessageDocument> =
  (mongoose.models.StoreContactMessage as Model<StoreContactMessageDocument> | undefined) ||
  mongoose.model<StoreContactMessageDocument>(
    'StoreContactMessage',
    storeContactMessageSchema as Schema<StoreContactMessageDocument>,
  );

export default StoreContactMessageModel;
