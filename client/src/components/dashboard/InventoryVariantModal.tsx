import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { InventoryVariantCreateInput, InventoryVariantUpdateInput, Product, ProductVariant } from '@/services/api/types';

const skuSchema = z
  .string()
  .trim()
  .min(2, 'SKU must be at least 2 characters')
  .max(64, 'SKU is too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'SKU can only contain letters, numbers, hyphen, and underscore');

const variantSchema = z.object({
  sku: skuSchema,
  name: z.string().trim().max(120, 'Variant name is too long').optional(),
  stock: z.number().min(0, 'Stock cannot be negative').optional(),
  lowStockThreshold: z.number().min(0, 'Low stock threshold cannot be negative'),
  isDefault: z.boolean(),
});

type InventoryVariantFormValues = {
  sku: string;
  name?: string;
  stock?: number;
  lowStockThreshold: number;
  isDefault: boolean;
};

type InventoryVariantModalProps = {
  mode: 'create' | 'edit';
  open: boolean;
  product: Product | null;
  variant: ProductVariant | null;
  isSubmitting: boolean;
  submitError: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: InventoryVariantCreateInput | InventoryVariantUpdateInput) => Promise<void>;
};

export default function InventoryVariantModal({
  mode,
  open,
  product,
  variant,
  isSubmitting,
  submitError,
  onOpenChange,
  onSubmit,
}: InventoryVariantModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InventoryVariantFormValues>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      sku: '',
      name: '',
      stock: 0,
      lowStockThreshold: 5,
      isDefault: false,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === 'edit' && variant) {
      reset({
        sku: variant.sku,
        name: variant.name,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
        isDefault: variant.isDefault,
      });
      return;
    }

    reset({
      sku: '',
      name: '',
      stock: 0,
      lowStockThreshold: 5,
      isDefault: Boolean(product && product.variants.length === 0),
    });
  }, [mode, open, product, reset, variant]);

  if (!open) {
    return null;
  }

  const title = mode === 'create' ? 'Add Variant' : 'Edit Variant';
  const description = product
    ? `Manage SKU-level inventory for ${product.title}.`
    : 'Manage SKU-level inventory.';

  const submitHandler = handleSubmit(async (values) => {
    if (mode === 'create') {
      if (!product) {
        return;
      }

      const openingStock = Number.isFinite(values.stock) ? (values.stock ?? 0) : 0;

      await onSubmit({
        productId: product.id,
        sku: values.sku.trim(),
        name: values.name?.trim() || undefined,
        stock: openingStock,
        lowStockThreshold: values.lowStockThreshold,
        isDefault: values.isDefault,
      });
      return;
    }

    await onSubmit({
      sku: values.sku.trim(),
      name: values.name?.trim() || undefined,
      lowStockThreshold: values.lowStockThreshold,
      isDefault: values.isDefault,
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="max-w-lg rounded-2xl border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
    >
      <form className="space-y-4" onSubmit={submitHandler}>
        <div className="space-y-2">
          <Label htmlFor="variant-sku" className="text-slate-700">SKU</Label>
          <Input id="variant-sku" className="border-slate-200" {...register('sku')} />
          {errors.sku ? <p className="text-xs text-destructive">{errors.sku.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="variant-name" className="text-slate-700">Variant name</Label>
          <Input id="variant-name" placeholder="Default" className="border-slate-200" {...register('name')} />
          {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
        </div>

        {mode === 'create' ? (
          <div className="space-y-2">
            <Label htmlFor="variant-stock" className="text-slate-700">Opening stock</Label>
            <Input
              id="variant-stock"
              type="number"
              min="0"
              step="1"
              className="border-slate-200"
              {...register('stock', { valueAsNumber: true })}
            />
            {errors.stock ? <p className="text-xs text-destructive">{errors.stock.message}</p> : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="variant-threshold" className="text-slate-700">Low stock threshold</Label>
          <Input
            id="variant-threshold"
            type="number"
            min="0"
            step="1"
            className="border-slate-200"
            {...register('lowStockThreshold', { valueAsNumber: true })}
          />
          {errors.lowStockThreshold ? (
            <p className="text-xs text-destructive">{errors.lowStockThreshold.message}</p>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('isDefault')} />
          Make this the default variant
        </label>

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg border-slate-200 text-slate-600"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Variant'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
