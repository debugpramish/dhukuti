import { z } from 'zod';

export const updateStoreSettingsSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'Storefront name must be at least 2 characters')
    .max(63, 'Storefront name cannot exceed 63 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Storefront name can only use lowercase letters, numbers, and hyphens')
    .optional(),
  name: z.string().trim().min(2, 'Store name must be at least 2 characters'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters'),
  phone: z.string().trim().min(7, 'Please enter a valid phone number'),
  address: z.string().trim().min(5, 'Address must be at least 5 characters'),
});

export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;
