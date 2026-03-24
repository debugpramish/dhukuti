import mongoose, { type Document, type Model, type Schema, type Types } from 'mongoose';

export interface CustomerDocument extends Document {
  storeId: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  address: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new mongoose.Schema<CustomerDocument>(
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
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Enforce uniqueness per store: same email can exist across stores but not within one store.
customerSchema.index({ storeId: 1, email: 1 }, { unique: true });

// Supports fast customer listing/pagination within a store.
customerSchema.index({ storeId: 1, createdAt: -1, _id: -1 });

// Supports case-insensitive prefix-style name filtering per store.
customerSchema.index({ storeId: 1, name: 1, _id: 1 });

const CustomerModel: Model<CustomerDocument> =
  (mongoose.models.Customer as Model<CustomerDocument> | undefined) ||
  mongoose.model<CustomerDocument>('Customer', customerSchema as Schema<CustomerDocument>);

export default CustomerModel;
