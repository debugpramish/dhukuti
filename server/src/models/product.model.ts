import mongoose, { type Document, type Model, type Schema, type Types } from 'mongoose';

export const PRODUCT_STATUS_VALUES = ['active', 'draft', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUS_VALUES)[number];
export const PRODUCT_DISCOUNT_TYPE_VALUES = ['none', 'percentage', 'fixed'] as const;
export type ProductDiscountType = (typeof PRODUCT_DISCOUNT_TYPE_VALUES)[number];
export const PRODUCT_PAYMENT_POLICY_VALUES = ['PREPAID_ONLY', 'POSTPAID'] as const;
export type ProductPaymentPolicy = (typeof PRODUCT_PAYMENT_POLICY_VALUES)[number];

export interface ProductVariant {
  _id: Types.ObjectId;
  sku: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
  isDefault: boolean;
}

export interface ProductDocument extends Document {
  ownerId: Types.ObjectId;
  title: string;
  category: string;
  price: number;
  discountType: ProductDiscountType;
  discountValue: number;
  imageUrl: string;
  status: ProductStatus;
  paymentPolicy: ProductPaymentPolicy;
  isFeatured: boolean;
  isTrending: boolean;
  isBestSeller: boolean;
  variants: ProductVariant[];
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new mongoose.Schema<ProductDocument>(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
      immutable: true,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'Uncategorized',
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountType: {
      type: String,
      enum: PRODUCT_DISCOUNT_TYPE_VALUES,
      default: 'none',
      index: true,
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: PRODUCT_STATUS_VALUES,
      default: 'active',
    },
    paymentPolicy: {
      type: String,
      enum: PRODUCT_PAYMENT_POLICY_VALUES,
      default: 'POSTPAID',
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isTrending: {
      type: Boolean,
      default: false,
      index: true,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
      index: true,
    },
    variants: {
      type: [
        new mongoose.Schema<ProductVariant>(
          {
            sku: {
              type: String,
              required: true,
              trim: true,
              maxlength: 64,
            },
            name: {
              type: String,
              trim: true,
              maxlength: 120,
              default: 'Default',
            },
            stock: {
              type: Number,
              min: 0,
              default: 0,
            },
            lowStockThreshold: {
              type: Number,
              min: 0,
              default: 5,
            },
            isDefault: {
              type: Boolean,
              default: false,
            },
          },
          {
            _id: true,
          },
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

productSchema.index({ ownerId: 1, createdAt: -1 });
productSchema.index({ ownerId: 1, isFeatured: 1, status: 1 });
productSchema.index({ ownerId: 1, isTrending: 1, status: 1 });
productSchema.index({ ownerId: 1, isBestSeller: 1, status: 1 });
productSchema.index({ ownerId: 1, category: 1, createdAt: -1 });

const ProductModel: Model<ProductDocument> =
  (mongoose.models.Product as Model<ProductDocument> | undefined) ||
  mongoose.model<ProductDocument>('Product', productSchema as Schema<ProductDocument>);

export default ProductModel;
