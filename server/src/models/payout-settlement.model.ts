import mongoose, { type Document, type Model, type Schema, type Types } from 'mongoose';

export const PAYOUT_PROVIDER_VALUES = ['esewa', 'khalti', 'cod'] as const;
export type PayoutProvider = (typeof PAYOUT_PROVIDER_VALUES)[number];

export const PAYOUT_SETTLEMENT_STATUS_VALUES = ['pending', 'settled', 'failed'] as const;
export type PayoutSettlementStatus = (typeof PAYOUT_SETTLEMENT_STATUS_VALUES)[number];

export interface PayoutSettlementDocument extends Document {
  ownerId: Types.ObjectId;
  provider: PayoutProvider;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  status: PayoutSettlementStatus;
  settlementReference?: string;
  gatewayName?: string;
  settlementDate?: Date;
  reconciled: boolean;
  reconciledAt?: Date;
  reconciliationNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const payoutSettlementSchema = new mongoose.Schema<PayoutSettlementDocument>(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: PAYOUT_PROVIDER_VALUES,
      required: true,
      index: true,
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    feeAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: PAYOUT_SETTLEMENT_STATUS_VALUES,
      default: 'pending',
      index: true,
    },
    settlementReference: {
      type: String,
      trim: true,
      maxlength: 120,
      index: true,
    },
    gatewayName: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    settlementDate: {
      type: Date,
      index: true,
    },
    reconciled: {
      type: Boolean,
      default: false,
      index: true,
    },
    reconciledAt: {
      type: Date,
    },
    reconciliationNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

payoutSettlementSchema.index({ ownerId: 1, provider: 1, status: 1, settlementDate: -1 });
payoutSettlementSchema.index({ ownerId: 1, createdAt: -1 });

const PayoutSettlementModel: Model<PayoutSettlementDocument> =
  (mongoose.models.PayoutSettlement as Model<PayoutSettlementDocument> | undefined) ||
  mongoose.model<PayoutSettlementDocument>(
    'PayoutSettlement',
    payoutSettlementSchema as Schema<PayoutSettlementDocument>,
  );

export default PayoutSettlementModel;
