import mongoose, { type Document, type Model, type Schema, type Types } from 'mongoose';

export const STORE_COURIER_VALUES = ['nepal-post', 'pathao', 'delivery-sathi'] as const;
export type StoreCourier = (typeof STORE_COURIER_VALUES)[number];

export interface StoreShippingRules {
  baseFee: number;
  freeShippingAbove: number;
  codEnabled: boolean;
  codFee: number;
  defaultCourier: StoreCourier;
  supportedCouriers: StoreCourier[];
}

export interface StoreDocument extends Document {
  ownerId: Types.ObjectId;
  slug: string;
  name: string;
  description: string;
  phone: string;
  address: string;
  logoUrl?: string;
  shippingRules: StoreShippingRules;
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new mongoose.Schema<StoreDocument>(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 120,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000,
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
    logoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    shippingRules: {
      type: new mongoose.Schema<StoreShippingRules>(
        {
          baseFee: {
            type: Number,
            min: 0,
            default: 100,
          },
          freeShippingAbove: {
            type: Number,
            min: 0,
            default: 1000,
          },
          codEnabled: {
            type: Boolean,
            default: true,
          },
          codFee: {
            type: Number,
            min: 0,
            default: 50,
          },
          defaultCourier: {
            type: String,
            enum: STORE_COURIER_VALUES,
            default: 'nepal-post',
          },
          supportedCouriers: {
            type: [
              {
                type: String,
                enum: STORE_COURIER_VALUES,
              },
            ],
            default: () => [...STORE_COURIER_VALUES],
          },
        },
        {
          _id: false,
        },
      ),
      default: () => ({
        baseFee: 100,
        freeShippingAbove: 1000,
        codEnabled: true,
        codFee: 50,
        defaultCourier: 'nepal-post',
        supportedCouriers: [...STORE_COURIER_VALUES],
      }),
    },
  },
  {
    timestamps: true,
  },
);

const StoreModel: Model<StoreDocument> =
  (mongoose.models.Store as Model<StoreDocument> | undefined) ||
  mongoose.model<StoreDocument>('Store', storeSchema as Schema<StoreDocument>);

export default StoreModel;
