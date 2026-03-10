import { z } from 'zod';

import { INVENTORY_REASON_VALUES } from '../models/inventory-log.model';

const objectIdPattern = /^[a-fA-F0-9]{24}$/;

const skuSchema = z
  .string()
  .trim()
  .min(2, 'SKU must be at least 2 characters')
  .max(64, 'SKU is too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'SKU can only contain letters, numbers, hyphen, and underscore');

export const createVariantSchema = z.object({
  productId: z.string().trim().regex(objectIdPattern, 'Invalid product id'),
  sku: skuSchema,
  name: z.string().trim().max(120, 'Variant name is too long').optional(),
  stock: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().finite('Stock must be a valid number').min(0, 'Stock cannot be negative').default(0),
  ),
  lowStockThreshold: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().finite('Low stock threshold must be a valid number').min(0, 'Low stock threshold cannot be negative').default(5),
  ),
  isDefault: z.preprocess(
    (value) => {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        return value === 'true' || value === '1' || value.toLowerCase() === 'on';
      }
      return false;
    },
    z.boolean(),
  ).default(false),
});

export const updateVariantSchema = z.object({
  sku: skuSchema.optional(),
  name: z.string().trim().max(120, 'Variant name is too long').optional(),
  lowStockThreshold: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().finite('Low stock threshold must be a valid number').min(0, 'Low stock threshold cannot be negative'),
  ).optional(),
  isDefault: z.preprocess(
    (value) => {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        return value === 'true' || value === '1' || value.toLowerCase() === 'on';
      }
      return value;
    },
    z.boolean(),
  ).optional(),
});

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().trim().regex(objectIdPattern, 'Invalid product id'),
  variantId: z.string().trim().regex(objectIdPattern, 'Invalid variant id'),
  adjustmentType: z.enum(['set', 'increase', 'decrease']),
  quantity: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().finite('Quantity must be a valid number').min(0, 'Quantity cannot be negative'),
  ),
  reason: z.enum(INVENTORY_REASON_VALUES).default('manual_adjustment'),
  note: z.string().trim().max(400, 'Note is too long').optional(),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;
