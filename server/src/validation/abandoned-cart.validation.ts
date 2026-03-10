import { z } from 'zod';

export const abandonedCartListQuerySchema = z.object({
  status: z.enum(['open', 'recovered', 'all']).default('open'),
  thresholdMinutes: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 30;
      }

      return typeof value === 'string' ? Number(value) : value;
    },
    z.number().int('Threshold must be an integer').min(1, 'Threshold must be at least 1 minute').max(43200, 'Threshold is too large').default(30),
  ),
  limit: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 50;
      }

      return typeof value === 'string' ? Number(value) : value;
    },
    z.number().int('Limit must be an integer').min(1, 'Limit must be at least 1').max(200, 'Limit is too large').default(50),
  ),
});

export const abandonedCartAnalyticsQuerySchema = z.object({
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
  thresholdMinutes: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 30;
      }

      return typeof value === 'string' ? Number(value) : value;
    },
    z.number().int('Threshold must be an integer').min(1, 'Threshold must be at least 1 minute').max(43200, 'Threshold is too large').default(30),
  ),
});

export const sendAbandonedReminderSchema = z.object({
  note: z.string().trim().max(240, 'Note is too long').optional(),
});

export const autoReminderRunSchema = z.object({
  thresholdMinutes: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 30;
      }

      return typeof value === 'string' ? Number(value) : value;
    },
    z.number().int('Threshold must be an integer').min(1, 'Threshold must be at least 1 minute').max(43200, 'Threshold is too large').default(30),
  ),
  cooldownMinutes: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 240;
      }

      return typeof value === 'string' ? Number(value) : value;
    },
    z.number().int('Cooldown must be an integer').min(1, 'Cooldown must be at least 1 minute').max(43200, 'Cooldown is too large').default(240),
  ),
  limit: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return 50;
      }

      return typeof value === 'string' ? Number(value) : value;
    },
    z.number().int('Limit must be an integer').min(1, 'Limit must be at least 1').max(200, 'Limit is too large').default(50),
  ),
});

export type AbandonedCartListQuery = z.infer<typeof abandonedCartListQuerySchema>;
export type AbandonedCartAnalyticsQuery = z.infer<typeof abandonedCartAnalyticsQuerySchema>;
export type SendAbandonedReminderInput = z.infer<typeof sendAbandonedReminderSchema>;
export type AutoReminderRunInput = z.infer<typeof autoReminderRunSchema>;
