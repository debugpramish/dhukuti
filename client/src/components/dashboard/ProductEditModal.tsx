import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DISCOUNT_TYPE_VALUES, type DiscountType, type Product, type ProductUpdateInput } from '@/services/api/types';

const productEditSchema = z.object({
  price: z.number().min(0.01, 'Price must be greater than zero.'),
  discountType: z.enum(DISCOUNT_TYPE_VALUES),
  discountValue: z.number().min(0, 'Discount value cannot be negative.'),
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

type ProductEditFormValues = z.infer<typeof productEditSchema>;

type ProductEditModalProps = {
  product: Product | null;
  open: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ProductUpdateInput) => Promise<void>;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(value);
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

export default function ProductEditModal({
  product,
  open,
  isSubmitting,
  submitError,
  onOpenChange,
  onSubmit,
}: ProductEditModalProps) {
  const {
    control,
    register,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductEditFormValues>({
    resolver: zodResolver(productEditSchema),
    defaultValues: {
      price: 0,
      discountType: 'none',
      discountValue: 0,
      imageFile: undefined,
    },
  });

  const selectedImage = useWatch({
    control,
    name: 'imageFile',
  });

  useEffect(() => {
    if (!open || !product) {
      return;
    }

    reset({
      price: product.price,
      discountType: product.discountType,
      discountValue: product.discountValue,
      imageFile: undefined,
    });
  }, [open, product, reset]);

  const selectedPreviewUrl = useMemo(() => {
    if (!selectedImage) {
      return '';
    }

    return URL.createObjectURL(selectedImage);
  }, [selectedImage]);

  useEffect(
    () => () => {
      if (selectedPreviewUrl) {
        URL.revokeObjectURL(selectedPreviewUrl);
      }
    },
    [selectedPreviewUrl],
  );

  const previewUrl = selectedPreviewUrl || product?.imageUrl || '';

  const dialogDescription = useMemo(
    () =>
      product
        ? `Only image, price, and discount can be updated for ${product.title}. Title and layout are locked.`
        : 'Only image, price, and discount can be updated.',
    [product],
  );

  const submitHandler = handleSubmit(async (values) => {
    await onSubmit({
      price: values.price,
      discountType: values.discountType,
      discountValue: values.discountValue,
      imageFile: values.imageFile,
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Product"
      description={dialogDescription}
      className="max-w-2xl"
    >
      {!product ? null : (
        <form className="space-y-5" onSubmit={submitHandler}>
          <div className="space-y-2">
            <Label htmlFor="product-title">Title</Label>
            <Input id="product-title" value={product.title} disabled readOnly />
            <p className="text-xs text-muted-foreground">Title is controlled by the active store template.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-price">Price</Label>
            <Input
              id="product-price"
              type="number"
              step="0.01"
              min="0"
              {...register('price', { valueAsNumber: true })}
            />
            {errors.price ? <p className="text-xs text-destructive">{errors.price.message}</p> : null}
            <p className="text-xs text-muted-foreground">
              Current value: <span className="font-medium">{formatCurrency(product.price)}</span>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-discount-type">Discount Type</Label>
              <select
                id="product-discount-type"
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
              <Label htmlFor="product-discount-value">Discount Value</Label>
              <Input
                id="product-discount-value"
                type="number"
                step="0.01"
                min="0"
                {...register('discountValue', { valueAsNumber: true })}
              />
              {errors.discountValue ? <p className="text-xs text-destructive">{errors.discountValue.message}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-image">Product Image</Label>
            <Input
              id="product-image"
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
              <img src={previewUrl} alt={product.title} className="h-44 w-full object-cover" />
            </div>
          ) : null}

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
