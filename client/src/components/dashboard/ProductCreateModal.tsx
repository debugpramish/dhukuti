import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DISCOUNT_TYPE_VALUES,
  PRODUCT_PAYMENT_POLICY_VALUES,
  PRODUCT_STATUS_VALUES,
  type DiscountType,
  type ProductCreateInput,
  type ProductPaymentPolicy,
  type ProductStatus,
} from '@/services/api/types';

const productCreateSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200, 'Title is too long'),
  category: z.string().trim().min(2, 'Category must be at least 2 characters').max(80, 'Category is too long'),
  price: z.number().min(0.01, 'Price must be greater than zero.'),
  stock: z.number().min(0, 'Stock cannot be negative'),
  lowStockThreshold: z.number().min(0, 'Low stock threshold cannot be negative'),
  status: z.enum(PRODUCT_STATUS_VALUES),
  paymentPolicy: z.enum(PRODUCT_PAYMENT_POLICY_VALUES),
  discountType: z.enum(DISCOUNT_TYPE_VALUES),
  discountValue: z.number().min(0, 'Discount value cannot be negative'),
  isFeatured: z.boolean(),
  isTrending: z.boolean(),
  isBestSeller: z.boolean(),
  imageFile: z
    .custom<File | undefined>((value) => value === undefined || value instanceof File, {
      message: 'Please upload a valid image file.',
    })
    .refine((file) => !file || file.type.startsWith('image/'), 'Only image files are allowed.')
    .refine((file) => !file || file.size <= 5 * 1024 * 1024, 'Image must be 5MB or less.')
    .optional(),
}).superRefine((value, ctx) => {
  if (value.discountType === 'none') {
    return;
  }

  if (value.discountValue <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'Discount value must be greater than zero.',
    });
  }

  if (value.discountType === 'percentage' && value.discountValue > 95) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountValue'],
      message: 'Percentage discount cannot exceed 95%.',
    });
  }
});

type ProductCreateFormValues = z.infer<typeof productCreateSchema>;

type ProductCreateModalProps = {
  open: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ProductCreateInput) => Promise<void>;
};

function formatStatus(status: ProductStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDiscountType(discountType: DiscountType): string {
  if (discountType === 'percentage') {
    return 'Percentage';
  }

  if (discountType === 'fixed') {
    return 'Fixed amount';
  }

  return 'No discount';
}

function formatPaymentPolicy(policy: ProductPaymentPolicy): string {
  if (policy === 'PREPAID_ONLY') {
    return 'Prepaid Only';
  }

  return 'Postpaid (COD Allowed)';
}

export default function ProductCreateModal({
  open,
  isSubmitting,
  submitError,
  onOpenChange,
  onSubmit,
}: ProductCreateModalProps) {
  const {
    control,
    register,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductCreateFormValues>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: {
      title: '',
      category: 'Uncategorized',
      price: 0,
      stock: 0,
      lowStockThreshold: 5,
      status: 'active',
      paymentPolicy: 'POSTPAID',
      discountType: 'none',
      discountValue: 0,
      isFeatured: false,
      isTrending: false,
      isBestSeller: false,
      imageFile: undefined,
    },
  });

  const selectedImage = useWatch({
    control,
    name: 'imageFile',
  });

  useEffect(() => {
    if (!open) {
      reset({
        title: '',
        category: 'Uncategorized',
        price: 0,
        stock: 0,
        lowStockThreshold: 5,
        status: 'active',
        paymentPolicy: 'POSTPAID',
        discountType: 'none',
        discountValue: 0,
        isFeatured: false,
        isTrending: false,
        isBestSeller: false,
        imageFile: undefined,
      });
    }
  }, [open, reset]);

  const previewUrl = useMemo(() => {
    if (!selectedImage) {
      return '';
    }

    return URL.createObjectURL(selectedImage);
  }, [selectedImage]);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  const submitHandler = handleSubmit(async (values) => {
    await onSubmit({
      title: values.title,
      category: values.category,
      price: values.price,
      stock: values.stock,
      lowStockThreshold: values.lowStockThreshold,
      status: values.status,
      paymentPolicy: values.paymentPolicy,
      discountType: values.discountType,
      discountValue: values.discountValue,
      isFeatured: values.isFeatured,
      isTrending: values.isTrending,
      isBestSeller: values.isBestSeller,
      imageFile: values.imageFile,
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add Product"
      description="Create a new product in your merchant catalog. Title becomes readonly after creation."
      className="max-w-2xl"
    >
      <form className="space-y-5" onSubmit={submitHandler}>
        <div className="space-y-2">
          <Label htmlFor="new-product-title">Title</Label>
          <Input id="new-product-title" placeholder="Enter product title" {...register('title')} />
          {errors.title ? <p className="text-xs text-destructive">{errors.title.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-product-category">Category</Label>
          <Input id="new-product-category" placeholder="e.g. Apparel" {...register('category')} />
          {errors.category ? <p className="text-xs text-destructive">{errors.category.message}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-product-price">Price</Label>
            <Input
              id="new-product-price"
              type="number"
              step="0.01"
              min="0"
              {...register('price', { valueAsNumber: true })}
            />
            {errors.price ? <p className="text-xs text-destructive">{errors.price.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-product-status">Status</Label>
            <select
              id="new-product-status"
              {...register('status')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PRODUCT_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
            {errors.status ? <p className="text-xs text-destructive">{errors.status.message}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-product-payment-policy">Product Payment Policy</Label>
          <select
            id="new-product-payment-policy"
            {...register('paymentPolicy')}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {PRODUCT_PAYMENT_POLICY_VALUES.map((policy) => (
              <option key={policy} value={policy}>
                {formatPaymentPolicy(policy)}
              </option>
            ))}
          </select>
          {errors.paymentPolicy ? <p className="text-xs text-destructive">{errors.paymentPolicy.message}</p> : null}
          <p className="text-xs text-muted-foreground">
            Prepaid Only requires online payment at checkout. Postpaid allows COD and online payments.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-product-stock">Opening stock</Label>
            <Input
              id="new-product-stock"
              type="number"
              step="1"
              min="0"
              {...register('stock', { valueAsNumber: true })}
            />
            {errors.stock ? <p className="text-xs text-destructive">{errors.stock.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-product-low-stock">Low stock threshold</Label>
            <Input
              id="new-product-low-stock"
              type="number"
              step="1"
              min="0"
              {...register('lowStockThreshold', { valueAsNumber: true })}
            />
            {errors.lowStockThreshold ? (
              <p className="text-xs text-destructive">{errors.lowStockThreshold.message}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-product-discount-type">Discount Type</Label>
            <select
              id="new-product-discount-type"
              {...register('discountType')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {DISCOUNT_TYPE_VALUES.map((discountType) => (
                <option key={discountType} value={discountType}>
                  {formatDiscountType(discountType)}
                </option>
              ))}
            </select>
            {errors.discountType ? <p className="text-xs text-destructive">{errors.discountType.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-product-discount-value">Discount Value</Label>
            <Input
              id="new-product-discount-value"
              type="number"
              step="0.01"
              min="0"
              {...register('discountValue', { valueAsNumber: true })}
            />
            {errors.discountValue ? <p className="text-xs text-destructive">{errors.discountValue.message}</p> : null}
            <p className="text-xs text-muted-foreground">
              Use % for percentage, or fixed currency amount when fixed type is selected.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" className="size-4 rounded border-input" {...register('isFeatured')} />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" className="size-4 rounded border-input" {...register('isTrending')} />
            Trending
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" className="size-4 rounded border-input" {...register('isBestSeller')} />
            Best Seller
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          These tags control which storefront section the product appears in.
        </p>

        <div className="space-y-2">
          <Label htmlFor="new-product-image">Product Image</Label>
          <Input
            id="new-product-image"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setValue('imageFile', file, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
          {errors.imageFile ? <p className="text-xs text-destructive">{errors.imageFile.message}</p> : null}
        </div>

        {previewUrl ? (
          <div className="overflow-hidden rounded-lg border">
            <img src={previewUrl} alt="Product preview" className="h-44 w-full object-cover" />
          </div>
        ) : null}

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
