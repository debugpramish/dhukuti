import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  INVENTORY_ADJUSTMENT_TYPE_VALUES,
  INVENTORY_REASON_VALUES,
  type InventoryAdjustmentInput,
  type InventoryAdjustmentType,
  type InventoryReason,
  type Product,
  type ProductVariant,
} from '@/services/api/types';

const manualReasonOptions = INVENTORY_REASON_VALUES.filter((reason) => reason !== 'order');

const adjustmentSchema = z
  .object({
    adjustmentType: z.enum(INVENTORY_ADJUSTMENT_TYPE_VALUES),
    quantity: z.number().min(0, 'Quantity cannot be negative'),
    reason: z.enum(INVENTORY_REASON_VALUES),
    note: z.string().trim().max(400, 'Note is too long').optional(),
  })
  .superRefine((values, ctx) => {
    if (values.adjustmentType !== 'set' && values.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity'],
        message: 'Quantity must be greater than zero.',
      });
    }
  });

type AdjustmentFormValues = {
  adjustmentType: InventoryAdjustmentType;
  quantity: number;
  reason: InventoryReason;
  note?: string;
};

type InventoryAdjustmentModalProps = {
  open: boolean;
  product: Product | null;
  variant: ProductVariant | null;
  isSubmitting: boolean;
  submitError: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: InventoryAdjustmentInput) => Promise<void>;
};

export default function InventoryAdjustmentModal({
  open,
  product,
  variant,
  isSubmitting,
  submitError,
  onOpenChange,
  onSubmit,
}: InventoryAdjustmentModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      adjustmentType: 'set',
      quantity: 0,
      reason: 'manual_adjustment',
      note: '',
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      adjustmentType: 'set',
      quantity: variant?.stock ?? 0,
      reason: 'manual_adjustment',
      note: '',
    });
  }, [open, reset, variant]);

  if (!open) {
    return null;
  }

  const title = 'Adjust Stock';
  const description = product && variant ? `${product.title} · ${variant.name || 'Default'} (${variant.sku})` : undefined;

  const submitHandler = handleSubmit(async (values) => {
    if (!product || !variant) {
      return;
    }

    await onSubmit({
      productId: product.id,
      variantId: variant.id,
      adjustmentType: values.adjustmentType,
      quantity: values.quantity,
      reason: values.reason,
      note: values.note?.trim() || undefined,
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="max-w-md rounded-2xl border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
    >
      <form className="space-y-4" onSubmit={submitHandler}>
        <div className="space-y-2">
          <Label htmlFor="adjustment-type" className="text-slate-700">Adjustment type</Label>
          <select
            id="adjustment-type"
            {...register('adjustmentType')}
            className="h-10 w-full rounded-md border border-slate-200 bg-background px-3 text-sm"
          >
            <option value="set">Set stock</option>
            <option value="increase">Increase stock</option>
            <option value="decrease">Decrease stock</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adjustment-quantity" className="text-slate-700">Quantity</Label>
          <Input
            id="adjustment-quantity"
            type="number"
            min="0"
            step="1"
            className="border-slate-200"
            {...register('quantity', { valueAsNumber: true })}
          />
          {errors.quantity ? <p className="text-xs text-destructive">{errors.quantity.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="adjustment-reason" className="text-slate-700">Reason</Label>
          <select
            id="adjustment-reason"
            {...register('reason')}
            className="h-10 w-full rounded-md border border-slate-200 bg-background px-3 text-sm"
          >
            {manualReasonOptions.map((reason) => (
              <option key={reason} value={reason}>
                {reason.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adjustment-note" className="text-slate-700">Note</Label>
          <Input id="adjustment-note" placeholder="Optional note" className="border-slate-200" {...register('note')} />
          {errors.note ? <p className="text-xs text-destructive">{errors.note.message}</p> : null}
        </div>

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
            {isSubmitting ? 'Saving...' : 'Apply Adjustment'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
