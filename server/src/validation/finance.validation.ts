import { z } from 'zod';

import { FINANCE_EXPENSE_CATEGORY_VALUES } from '../models/finance-expense.model';
import { PAYOUT_PROVIDER_VALUES, PAYOUT_SETTLEMENT_STATUS_VALUES } from '../models/payout-settlement.model';

function parseOptionalDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

export const financeDateRangeQuerySchema = z.object({
  dateFrom: z
    .string()
    .trim()
    .datetime({ offset: true, message: 'dateFrom must be a valid ISO date-time string' })
    .optional(),
  dateTo: z
    .string()
    .trim()
    .datetime({ offset: true, message: 'dateTo must be a valid ISO date-time string' })
    .optional(),
  limit: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 100;
      }

      return typeof value === 'string' ? Number(value) : value;
    },
    z.number().int('Limit must be an integer').min(1, 'Limit must be at least 1').max(200, 'Limit is too large').default(100),
  ),
});

export const createFinanceExpenseSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(160, 'Title is too long'),
  category: z.enum(FINANCE_EXPENSE_CATEGORY_VALUES),
  amount: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().finite('Amount must be a valid number').min(0, 'Amount cannot be negative'),
  ),
  note: z.string().trim().max(500, 'Note is too long').optional(),
  incurredAt: z.preprocess(
    (value) => parseOptionalDate(value),
    z.date({ message: 'incurredAt must be a valid date' }),
  ),
});

export const updateFinanceExpenseSchema = z
  .object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').max(160, 'Title is too long').optional(),
    category: z.enum(FINANCE_EXPENSE_CATEGORY_VALUES).optional(),
    amount: z
      .preprocess(
        (value) => (value === undefined ? undefined : typeof value === 'string' ? Number(value) : value),
        z.number().finite('Amount must be a valid number').min(0, 'Amount cannot be negative').optional(),
      )
      .optional(),
    note: z.string().trim().max(500, 'Note is too long').optional(),
    incurredAt: z
      .preprocess(
        (value) => (value === undefined ? undefined : parseOptionalDate(value)),
        z.date({ message: 'incurredAt must be a valid date' }).optional(),
      )
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required to update expense',
  });

export const createPayoutSettlementSchema = z.object({
  provider: z.enum(PAYOUT_PROVIDER_VALUES),
  grossAmount: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().finite('Gross amount must be a valid number').min(0, 'Gross amount cannot be negative'),
  ),
  feeAmount: z
    .preprocess(
      (value) => (value === undefined ? 0 : typeof value === 'string' ? Number(value) : value),
      z.number().finite('Fee amount must be a valid number').min(0, 'Fee amount cannot be negative').default(0),
    )
    .default(0),
  status: z.enum(PAYOUT_SETTLEMENT_STATUS_VALUES).default('pending'),
  settlementReference: z.string().trim().max(120, 'Settlement reference is too long').optional(),
  gatewayName: z.string().trim().max(80, 'Gateway name is too long').optional(),
  settlementDate: z.preprocess(
    (value) => parseOptionalDate(value),
    z.date({ message: 'settlementDate must be a valid date' }).optional(),
  ),
  reconciliationNote: z.string().trim().max(500, 'Reconciliation note is too long').optional(),
});

export const updatePayoutSettlementSchema = z
  .object({
    grossAmount: z
      .preprocess(
        (value) => (value === undefined ? undefined : typeof value === 'string' ? Number(value) : value),
        z.number().finite('Gross amount must be a valid number').min(0, 'Gross amount cannot be negative').optional(),
      )
      .optional(),
    feeAmount: z
      .preprocess(
        (value) => (value === undefined ? undefined : typeof value === 'string' ? Number(value) : value),
        z.number().finite('Fee amount must be a valid number').min(0, 'Fee amount cannot be negative').optional(),
      )
      .optional(),
    status: z.enum(PAYOUT_SETTLEMENT_STATUS_VALUES).optional(),
    settlementReference: z.string().trim().max(120, 'Settlement reference is too long').optional(),
    gatewayName: z.string().trim().max(80, 'Gateway name is too long').optional(),
    settlementDate: z
      .preprocess(
        (value) => {
          if (value === undefined) {
            return undefined;
          }

          if (value === null || value === '') {
            return null;
          }

          return parseOptionalDate(value);
        },
        z.union([z.date(), z.null()]).optional(),
      )
      .optional(),
    reconciled: z.boolean().optional(),
    reconciliationNote: z.string().trim().max(500, 'Reconciliation note is too long').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required to update settlement',
  });

export type FinanceDateRangeQuery = z.infer<typeof financeDateRangeQuerySchema>;
export type CreateFinanceExpenseInput = z.infer<typeof createFinanceExpenseSchema>;
export type UpdateFinanceExpenseInput = z.infer<typeof updateFinanceExpenseSchema>;
export type CreatePayoutSettlementInput = z.infer<typeof createPayoutSettlementSchema>;
export type UpdatePayoutSettlementInput = z.infer<typeof updatePayoutSettlementSchema>;
