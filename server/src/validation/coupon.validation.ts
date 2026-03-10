import { z } from 'zod';

import { COUPON_TYPE_VALUES } from '../models/coupon.model';

function parseNumberInput(value: unknown): unknown {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? Number(trimmed) : Number.NaN;
  }

  return value;
}

function parseIntegerInput(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? Number(trimmed) : Number.NaN;
  }

  return value;
}

function parseDateInput(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? value : date;
  }

  return value;
}

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'Code must be at least 3 characters')
      .max(40, 'Code is too long')
      .regex(/^[A-Za-z0-9_-]+$/, 'Code can only contain letters, numbers, hyphen, and underscore')
      .transform((value) => value.toUpperCase()),
    type: z.preprocess(
      (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
      z.enum(COUPON_TYPE_VALUES),
    ),
    value: z.preprocess(
      parseNumberInput,
      z.number().finite('Coupon value must be a valid number').min(0.01, 'Coupon value must be greater than zero'),
    ),
    minOrderAmount: z.preprocess(
      parseNumberInput,
      z.number().finite('Minimum order amount must be a valid number').min(0, 'Minimum order amount cannot be negative'),
    ).default(0),
    maxDiscountAmount: z.preprocess(
      parseNumberInput,
      z.number().finite('Max discount amount must be a valid number').min(0, 'Max discount amount cannot be negative'),
    ).optional(),
    isActive: z.preprocess(
      (value) => {
        if (typeof value === 'boolean') {
          return value;
        }

        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          return normalized === 'true' || normalized === '1' || normalized === 'on';
        }

        return true;
      },
      z.boolean(),
    ).default(true),
    usageLimit: z.preprocess(
      parseIntegerInput,
      z.number().int('Usage limit must be an integer').min(1, 'Usage limit must be at least 1'),
    ).optional(),
    expiresAt: z.preprocess(parseDateInput, z.date()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'percentage' && value.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Percentage coupon cannot exceed 100%',
      });
    }

    if (value.expiresAt && value.expiresAt.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresAt'],
        message: 'Expiry date must be in the future',
      });
    }
  });

export const createCouponSchema = couponSchema;
export const updateCouponSchema = couponSchema;

export const updateCouponStatusSchema = z.object({
  isActive: z.preprocess(
    (value) => {
      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'on';
      }

      return value;
    },
    z.boolean(),
  ),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type UpdateCouponStatusInput = z.infer<typeof updateCouponStatusSchema>;
