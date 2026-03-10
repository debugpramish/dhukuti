import { z } from 'zod';
import { ORDER_PAYMENT_METHOD_VALUES } from '../models/order.model';

const objectIdPattern = /^[a-fA-F0-9]{24}$/;

export const createPublicOrderSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(120, 'Name is too long'),
  customerPhone: z
    .string()
    .trim()
    .min(7, 'Phone number must be at least 7 characters')
    .max(32, 'Phone number is too long'),
  customerLocation: z
    .string()
    .trim()
    .min(5, 'Location must be at least 5 characters')
    .max(255, 'Location is too long'),
  items: z
    .array(
      z.object({
        productId: z
          .string()
          .trim()
          .regex(objectIdPattern, 'Invalid product id'),
        variantId: z
          .string()
          .trim()
          .regex(objectIdPattern, 'Invalid variant id')
          .optional(),
        sku: z
          .string()
          .trim()
          .min(2, 'SKU must be at least 2 characters')
          .max(64, 'SKU is too long')
          .regex(/^[A-Za-z0-9_-]+$/, 'SKU format is invalid')
          .optional(),
        quantity: z.preprocess(
          (value) => {
            if (typeof value === 'number') {
              return value;
            }

            if (typeof value === 'string') {
              const trimmed = value.trim();
              return trimmed.length > 0 ? Number(trimmed) : Number.NaN;
            }

            return value;
          },
          z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1').max(99, 'Quantity is too large'),
        ),
      }),
    )
    .min(1, 'At least one item is required')
    .max(100, 'Too many items in one order'),
  couponCode: z
    .string()
    .trim()
    .min(3, 'Coupon code must be at least 3 characters')
    .max(40, 'Coupon code is too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Coupon code format is invalid')
    .optional(),
  paymentMethod: z
    .preprocess(
      (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
      z.enum(ORDER_PAYMENT_METHOD_VALUES),
    )
    .default('cod'),
  paymentSessionId: z
    .string()
    .trim()
    .min(8, 'Payment session id is invalid')
    .max(120, 'Payment session id is too long')
    .regex(/^[A-Za-z0-9-]+$/, 'Payment session id format is invalid')
    .optional(),
  trafficSource: z
    .string()
    .trim()
    .min(2, 'Traffic source must be at least 2 characters')
    .max(64, 'Traffic source is too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Traffic source format is invalid')
    .optional(),
  sessionId: z
    .string()
    .trim()
    .min(8, 'Session id is invalid')
    .max(120, 'Session id is too long')
    .regex(/^[A-Za-z0-9-]+$/, 'Session id format is invalid')
    .optional(),
});

export type CreatePublicOrderInput = z.infer<typeof createPublicOrderSchema>;
