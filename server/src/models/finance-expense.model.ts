import mongoose, { type Document, type Model, type Schema, type Types } from 'mongoose';

export const FINANCE_EXPENSE_CATEGORY_VALUES = ['operations', 'marketing', 'salary', 'logistics', 'other'] as const;
export type FinanceExpenseCategory = (typeof FINANCE_EXPENSE_CATEGORY_VALUES)[number];

export interface FinanceExpenseDocument extends Document {
  ownerId: Types.ObjectId;
  title: string;
  category: FinanceExpenseCategory;
  amount: number;
  note?: string;
  incurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const financeExpenseSchema = new mongoose.Schema<FinanceExpenseDocument>(
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
      maxlength: 160,
    },
    category: {
      type: String,
      enum: FINANCE_EXPENSE_CATEGORY_VALUES,
      default: 'operations',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    incurredAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

financeExpenseSchema.index({ ownerId: 1, incurredAt: -1 });

const FinanceExpenseModel: Model<FinanceExpenseDocument> =
  (mongoose.models.FinanceExpense as Model<FinanceExpenseDocument> | undefined) ||
  mongoose.model<FinanceExpenseDocument>('FinanceExpense', financeExpenseSchema as Schema<FinanceExpenseDocument>);

export default FinanceExpenseModel;
