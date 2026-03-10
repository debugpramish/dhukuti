import { z } from 'zod';

export const createStoreContactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120, 'Name is too long'),
  email: z.string().trim().email('Please provide a valid email address').max(255, 'Email is too long'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000, 'Message is too long'),
});

export type CreateStoreContactMessageInput = z.infer<typeof createStoreContactMessageSchema>;
