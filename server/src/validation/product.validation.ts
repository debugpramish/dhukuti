import { z } from 'zod';

import { PRODUCT_DISCOUNT_TYPE_VALUES, PRODUCT_STATUS_VALUES } from '../models/product.model';

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

function parseBooleanInput(value: unknown): unknown {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true' || value === '1' || value.toLowerCase() === 'on';
  }

  return value;
}

const discountTypeSchema = z.enum(PRODUCT_DISCOUNT_TYPE_VALUES);

const productDiscountSchema = z
  .object({
    discountType: z.preprocess(
      (value) => {
        if (typeof value === 'string') {
          return value.trim().toLowerCase();
        }

        return value;
      },
      discountTypeSchema,
    ),
    discountValue: z.preprocess(
      parseNumberInput,
      z.number().finite('Discount value must be a valid number').min(0, 'Discount value cannot be negative'),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === 'none') {
      return;
    }

    if (value.discountValue <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Discount value must be greater than zero',
      });
      return;
    }

    if (value.discountType === 'percentage' && value.discountValue > 95) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 95%',
      });
    }
  });

function applyDiscountValidation(
  discountType: 'none' | 'percentage' | 'fixed',
  discountValue: number,
  ctx: z.RefinementCtx,
) {
  if (discountType === 'none') {
    return;
  }

  if (discountValue <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'Discount value must be greater than zero',
    });
    return;
  }

  if (discountType === 'percentage' && discountValue > 95) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'Percentage discount cannot exceed 95%',
    });
  }
}

export const createProductSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200, 'Title is too long'),
  category: z
    .string()
    .trim()
    .min(2, 'Category must be at least 2 characters')
    .max(80, 'Category is too long')
    .default('Uncategorized'),
  price: z.preprocess(
    parseNumberInput,
    z.number().finite('Price must be a valid number').min(0, 'Price cannot be negative'),
  ),
  stock: z.preprocess(
    parseNumberInput,
    z.number().finite('Stock must be a valid number').min(0, 'Stock cannot be negative'),
  ).default(0),
  lowStockThreshold: z.preprocess(
    parseNumberInput,
    z.number().finite('Low stock threshold must be a valid number').min(0, 'Low stock threshold cannot be negative'),
  ).default(5),
  status: z.preprocess(
    (value) => {
      if (typeof value === 'string') {
        return value.trim().toLowerCase();
      }

      return value;
    },
    z.enum(PRODUCT_STATUS_VALUES).default('active'),
  ),
  isFeatured: z.preprocess(parseBooleanInput, z.boolean()).default(false),
  isTrending: z.preprocess(parseBooleanInput, z.boolean()).default(false),
  isBestSeller: z.preprocess(parseBooleanInput, z.boolean()).default(false),
  discountType: productDiscountSchema.shape.discountType.default('none'),
  discountValue: productDiscountSchema.shape.discountValue.default(0),
}).superRefine((value, ctx) => {
  applyDiscountValidation(value.discountType, value.discountValue, ctx);
});

export const updateProductSchema = z
  .object({
    price: z.preprocess(
      parseNumberInput,
      z.number().finite('Price must be a valid number').min(0, 'Price cannot be negative'),
    ),
    discountType: productDiscountSchema.shape.discountType.default('none'),
    discountValue: productDiscountSchema.shape.discountValue.default(0),
  })
  .superRefine((value, ctx) => {
    applyDiscountValidation(value.discountType, value.discountValue, ctx);
  });

export const updateProductFeaturedSchema = z.object({
  isFeatured: z.preprocess(parseBooleanInput, z.boolean()),
});

export const updateProductFlagsSchema = z
  .object({
    isFeatured: z.preprocess(parseBooleanInput, z.boolean()).optional(),
    isTrending: z.preprocess(parseBooleanInput, z.boolean()).optional(),
    isBestSeller: z.preprocess(parseBooleanInput, z.boolean()).optional(),
  })
  .refine(
    (value) =>
      typeof value.isFeatured === 'boolean' ||
      typeof value.isTrending === 'boolean' ||
      typeof value.isBestSeller === 'boolean',
    {
      message: 'At least one flag must be provided',
    },
  );

export const updateProductTrendingSchema = z.object({
  isTrending: z.preprocess(parseBooleanInput, z.boolean()),
});

export const updateProductBestSellerSchema = z.object({
  isBestSeller: z.preprocess(parseBooleanInput, z.boolean()),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateProductFeaturedInput = z.infer<typeof updateProductFeaturedSchema>;
export type UpdateProductFlagsInput = z.infer<typeof updateProductFlagsSchema>;
