import { z } from 'zod';

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
