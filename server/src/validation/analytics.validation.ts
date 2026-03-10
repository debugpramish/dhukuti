import { z } from 'zod';

const objectIdPattern = /^[a-fA-F0-9]{24}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const analyticsDateRangeQuerySchema = z.object({
  dateFrom: z
    .string()
    .trim()
    .regex(datePattern, 'dateFrom must be in YYYY-MM-DD format')
    .optional(),
  dateTo: z
    .string()
    .trim()
    .regex(datePattern, 'dateTo must be in YYYY-MM-DD format')
    .optional(),
  limit: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 20;
      }

      return typeof value === 'string' ? Number(value) : value;
    },
    z.number().int('Limit must be an integer').min(1, 'Limit must be at least 1').max(100, 'Limit is too large').default(20),
  ),
});

export const trackStoreAnalyticsEventsSchema = z.object({
  sessionId: z
    .string()
    .trim()
    .min(8, 'Session id is invalid')
    .max(120, 'Session id is too long')
    .regex(/^[A-Za-z0-9-]+$/, 'Session id format is invalid'),
  trafficSource: z
    .string()
    .trim()
    .min(2, 'Traffic source must be at least 2 characters')
    .max(64, 'Traffic source is too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Traffic source format is invalid')
    .optional(),
  events: z
    .array(
      z.object({
        eventType: z.enum(['store_visit', 'product_view', 'checkout_started']),
        productId: z
          .string()
          .trim()
          .regex(objectIdPattern, 'Invalid product id')
          .optional(),
        sku: z
          .string()
          .trim()
          .min(2, 'SKU must be at least 2 characters')
          .max(64, 'SKU is too long')
          .regex(/^[A-Za-z0-9_-]+$/, 'SKU format is invalid')
          .optional(),
      }),
    )
    .min(1, 'At least one event is required')
    .max(100, 'Too many events in one request'),
});

export type AnalyticsDateRangeQuery = z.infer<typeof analyticsDateRangeQuerySchema>;
export type TrackStoreAnalyticsEventsInput = z.infer<typeof trackStoreAnalyticsEventsSchema>;
