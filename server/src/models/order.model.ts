import mongoose, { type Document, type Model, type Schema, type Types } from 'mongoose';

export const ORDER_STATUS_VALUES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];
export const ORDERED_BY_ROLE_VALUES = ['merchant', 'customer'] as const;
export type OrderedByRole = (typeof ORDERED_BY_ROLE_VALUES)[number];
export const ORDER_PAYMENT_METHOD_VALUES = ['cod', 'esewa', 'khalti'] as const;
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHOD_VALUES)[number];
export const ORDER_PAYMENT_STATUS_VALUES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUS_VALUES)[number];
export const ORDER_COD_STATUS_VALUES = ['pending', 'collected', 'failed', 'not_applicable'] as const;
export type OrderCodStatus = (typeof ORDER_COD_STATUS_VALUES)[number];
export const SHIPMENT_STATUS_VALUES = [
  'pending',
  'label_generated',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUS_VALUES)[number];

export interface OrderItem {
  title: string;
  quantity: number;
  unitPrice: number;
  sku?: string;
  variantName?: string;
}

export interface ShipmentHistoryEntry {
  status: ShipmentStatus;
  timestamp: Date;
  note?: string;
}

export interface OrderShipment {
  courier: string;
  trackingNumber: string;
  labelUrl: string;
  status: ShipmentStatus;
  history: ShipmentHistoryEntry[];
  estimatedDeliveryAt?: Date;
  lastUpdatedAt?: Date;
}

export interface OrderDocument extends Document {
  ownerId: Types.ObjectId;
  customerId?: Types.ObjectId;
  orderedByRole: OrderedByRole;
  orderNumber: string;
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
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  paymentReference?: string;
  codStatus: OrderCodStatus;
  codCollectedAmount: number;
  shipment?: OrderShipment;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new mongoose.Schema<OrderItem>(
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
    _id: true,
  },
);

const orderSchema = new mongoose.Schema<OrderDocument>(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    orderedByRole: {
      type: String,
      enum: ORDERED_BY_ROLE_VALUES,
      default: 'customer',
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
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
    trafficSource: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 64,
      default: 'direct',
      index: true,
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
      index: true,
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
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ORDER_STATUS_VALUES,
      default: 'pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ORDER_PAYMENT_METHOD_VALUES,
      default: 'cod',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ORDER_PAYMENT_STATUS_VALUES,
      default: 'pending',
      index: true,
    },
    paymentReference: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    codStatus: {
      type: String,
      enum: ORDER_COD_STATUS_VALUES,
      default: 'pending',
      index: true,
    },
    codCollectedAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    shipment: {
      type: new mongoose.Schema<OrderShipment>(
        {
          courier: {
            type: String,
            trim: true,
            maxlength: 80,
            default: '',
          },
          trackingNumber: {
            type: String,
            trim: true,
            maxlength: 120,
            default: '',
          },
          labelUrl: {
            type: String,
            trim: true,
            default: '',
          },
          status: {
            type: String,
            enum: SHIPMENT_STATUS_VALUES,
            default: 'pending',
          },
          history: {
            type: [
              new mongoose.Schema<ShipmentHistoryEntry>(
                {
                  status: {
                    type: String,
                    enum: SHIPMENT_STATUS_VALUES,
                    required: true,
                  },
                  timestamp: {
                    type: Date,
                    required: true,
                  },
                  note: {
                    type: String,
                    trim: true,
                    maxlength: 240,
                  },
                },
                {
                  _id: false,
                },
              ),
            ],
            default: [],
          },
          estimatedDeliveryAt: {
            type: Date,
          },
          lastUpdatedAt: {
            type: Date,
          },
        },
        {
          _id: false,
        },
      ),
      default: undefined,
    },
    items: {
      type: [orderItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.index({ ownerId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ ownerId: 1, createdAt: -1 });
orderSchema.index({ ownerId: 1, trafficSource: 1, createdAt: -1 });

const OrderModel: Model<OrderDocument> =
  (mongoose.models.Order as Model<OrderDocument> | undefined) ||
  mongoose.model<OrderDocument>('Order', orderSchema as Schema<OrderDocument>);

export default OrderModel;
