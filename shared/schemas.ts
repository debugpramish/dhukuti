import { z } from 'zod';

// ── Auth ────────────────────────────────────────
export const registerSchema = z.object({
  name:         z.string().min(2, 'Name must be at least 2 characters'),
  email:        z.string().email('Invalid email address'),
  password:     z.string().min(8, 'Password must be at least 8 characters'),
  businessName: z.string().min(2, 'Business name required'),
  panNumber:    z.string().optional(),
});

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1, 'Password required'),
});

// ── Product ─────────────────────────────────────
export const productSchema = z.object({
  name:              z.string().min(1, 'Product name required'),
  nameNepali:        z.string().optional(),
  sku:               z.string().optional(),
  category:          z.string().optional(),
  unit:              z.string().default('piece'),
  buyingPrice:       z.number().min(0),
  sellingPrice:      z.number().min(0),
  currentStock:      z.number().min(0).default(0),
  lowStockThreshold: z.number().min(0).default(5),
  isPublic:          z.boolean().default(false),
});

// ── Stock Movement ───────────────────────────────
export const stockMovementSchema = z.object({
  type:     z.enum(['in', 'out', 'adjustment']),
  quantity: z.number().positive('Quantity must be positive'),
  reason:   z.enum(['purchase', 'sale', 'damaged', 'return', 'adjustment']),
  note:     z.string().optional(),
});

// ── Order ───────────────────────────────────────
export const orderSchema = z.object({
  customer: z.object({
    name:    z.string().min(1),
    phone:   z.string().min(10, 'Valid phone number required'),
    email:   z.string().email().optional(),
    address: z.string().min(5),
  }),
  items: z.array(z.object({
    productId: z.string(),
    quantity:  z.number().positive(),
  })).min(1, 'Order must have at least one item'),
  paymentMethod: z.enum(['esewa', 'khalti', 'cod', 'cash', 'bank']),
  note:          z.string().optional(),
});

// ── Types (inferred from schemas) ───────────────
export type RegisterInput      = z.infer<typeof registerSchema>;
export type LoginInput         = z.infer<typeof loginSchema>;
export type ProductInput       = z.infer<typeof productSchema>;
export type StockMovementInput = z.infer<typeof stockMovementSchema>;
export type OrderInput         = z.infer<typeof orderSchema>;

