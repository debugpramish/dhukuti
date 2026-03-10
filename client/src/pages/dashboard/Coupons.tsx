import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import CouponTable from '@/components/dashboard/CouponTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createCoupon,
  deleteCoupon,
  getCoupons,
  updateCoupon,
  updateCouponActive,
} from '@/services/api/couponApi';
import { COUPON_TYPE_VALUES, type Coupon, type CouponCreateInput, type CouponType } from '@/services/api/types';

const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'Code must be at least 3 characters')
      .max(40, 'Code is too long')
      .regex(/^[A-Za-z0-9_-]+$/, 'Only letters, numbers, hyphen, and underscore are allowed'),
    type: z.enum(COUPON_TYPE_VALUES),
    value: z.number().min(0.01, 'Value must be greater than zero'),
    minOrderAmount: z.number().min(0, 'Minimum order amount cannot be negative'),
    maxDiscountAmount: z.number().min(0, 'Maximum discount cannot be negative').optional(),
    usageLimit: z.number().int('Usage limit must be an integer').min(1, 'Usage limit must be at least 1').optional(),
    expiresAt: z.string().optional(),
    isActive: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'percentage' && value.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Percentage coupon cannot exceed 100%',
      });
    }
  });

type CouponFormValues = z.infer<typeof couponFormSchema>;

function formatCouponType(couponType: CouponType): string {
  return couponType === 'percentage' ? 'Percentage' : 'Fixed amount';
}

function normalizeDateInput(value?: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function toCouponPayload(values: CouponFormValues): CouponCreateInput {
  return {
    code: values.code.trim().toUpperCase(),
    type: values.type,
    value: values.value,
    minOrderAmount: values.minOrderAmount,
    maxDiscountAmount: values.maxDiscountAmount,
    isActive: values.isActive,
    usageLimit: values.usageLimit,
    expiresAt: values.expiresAt ? values.expiresAt : undefined,
  };
}

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: {
      code: '',
      type: 'percentage',
      value: 10,
      minOrderAmount: 0,
      maxDiscountAmount: undefined,
      usageLimit: undefined,
      expiresAt: '',
      isActive: true,
    },
  });

  const { data: coupons, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['coupons'],
    queryFn: getCoupons,
    retry: 1,
  });

  const createCouponMutation = useMutation({
    mutationFn: (payload: CouponCreateInput) => createCoupon(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
  });

  const updateCouponMutation = useMutation({
    mutationFn: ({ couponId, payload }: { couponId: string; payload: CouponCreateInput }) =>
      updateCoupon(couponId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
  });

  const deleteCouponMutation = useMutation({
    mutationFn: (couponId: string) => deleteCoupon(couponId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
  });

  const toggleCouponMutation = useMutation({
    mutationFn: ({ couponId, isActive }: { couponId: string; isActive: boolean }) =>
      updateCouponActive(couponId, isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
  });

  const modalTitle = useMemo(
    () => (editingCoupon ? `Edit Coupon ${editingCoupon.code}` : 'Create Coupon'),
    [editingCoupon],
  );

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);

    if (open) {
      return;
    }

    setEditingCoupon(null);
    setFormError(null);
    reset({
      code: '',
      type: 'percentage',
      value: 10,
      minOrderAmount: 0,
      maxDiscountAmount: undefined,
      usageLimit: undefined,
      expiresAt: '',
      isActive: true,
    });
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormError(null);
    reset({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount,
      maxDiscountAmount: coupon.maxDiscountAmount,
      usageLimit: coupon.usageLimit,
      expiresAt: normalizeDateInput(coupon.expiresAt),
      isActive: coupon.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmitCoupon = handleSubmit(async (values) => {
    setFormError(null);

    const payload = toCouponPayload(values);

    try {
      if (editingCoupon) {
        await updateCouponMutation.mutateAsync({
          couponId: editingCoupon.id,
          payload,
        });
      } else {
        await createCouponMutation.mutateAsync(payload);
      }

      setIsModalOpen(false);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to save coupon';
      setFormError(message);
    }
  });

  const handleDeleteCoupon = async (coupon: Coupon) => {
    const shouldDelete = window.confirm(`Delete coupon "${coupon.code}"?`);
    if (!shouldDelete) {
      return;
    }

    setDeleteError(null);
    try {
      await deleteCouponMutation.mutateAsync(coupon.id);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to delete coupon';
      setDeleteError(message);
    }
  };

  const handleToggleCoupon = async (coupon: Coupon) => {
    setToggleError(null);
    try {
      await toggleCouponMutation.mutateAsync({
        couponId: coupon.id,
        isActive: !coupon.isActive,
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to update coupon status';
      setToggleError(message);
    }
  };

  const deletingCouponId = deleteCouponMutation.isPending ? (deleteCouponMutation.variables ?? null) : null;
  const togglingCouponId = toggleCouponMutation.isPending
    ? (toggleCouponMutation.variables?.couponId ?? null)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Coupons</h1>
        <p className="text-sm text-muted-foreground">
          Create coupon codes customers can apply at checkout.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={openCreateModal}>
          Create Coupon
        </Button>
      </div>

      {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
      {toggleError ? <p className="text-sm text-destructive">{toggleError}</p> : null}

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading coupons...</CardContent>
        </Card>
      ) : null}

      {isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load coupons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Request failed'}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !isError && coupons && coupons.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No coupons created yet.
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !isError && coupons && coupons.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Coupon List</CardTitle>
          </CardHeader>
          <CardContent>
            <CouponTable
              coupons={coupons}
              deletingCouponId={deletingCouponId}
              togglingCouponId={togglingCouponId}
              onEdit={openEditModal}
              onDelete={(coupon) => void handleDeleteCoupon(coupon)}
              onToggleActive={(coupon) => void handleToggleCoupon(coupon)}
            />
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
        title={modalTitle}
        description="Coupon discounts apply after product discounts at checkout."
        className="max-w-2xl"
      >
        <form className="space-y-5" onSubmit={handleSubmitCoupon}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Code</Label>
              <Input
                id="coupon-code"
                placeholder="WELCOME10"
                {...register('code')}
              />
              {errors.code ? <p className="text-xs text-destructive">{errors.code.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon-type">Type</Label>
              <select
                id="coupon-type"
                {...register('type')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {COUPON_TYPE_VALUES.map((couponType) => (
                  <option key={couponType} value={couponType}>
                    {formatCouponType(couponType)}
                  </option>
                ))}
              </select>
              {errors.type ? <p className="text-xs text-destructive">{errors.type.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-value">Value</Label>
              <Input
                id="coupon-value"
                type="number"
                min="0"
                step="0.01"
                {...register('value', { valueAsNumber: true })}
              />
              {errors.value ? <p className="text-xs text-destructive">{errors.value.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon-min-order">Minimum order amount</Label>
              <Input
                id="coupon-min-order"
                type="number"
                min="0"
                step="0.01"
                {...register('minOrderAmount', { valueAsNumber: true })}
              />
              {errors.minOrderAmount ? <p className="text-xs text-destructive">{errors.minOrderAmount.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-max-discount">Max discount amount (optional)</Label>
              <Input
                id="coupon-max-discount"
                type="number"
                min="0"
                step="0.01"
                {...register('maxDiscountAmount', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
              {errors.maxDiscountAmount ? <p className="text-xs text-destructive">{errors.maxDiscountAmount.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon-usage-limit">Usage limit (optional)</Label>
              <Input
                id="coupon-usage-limit"
                type="number"
                min="1"
                step="1"
                {...register('usageLimit', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
              {errors.usageLimit ? <p className="text-xs text-destructive">{errors.usageLimit.message}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coupon-expires-at">Expiry date (optional)</Label>
            <Input id="coupon-expires-at" type="date" {...register('expiresAt')} />
            {errors.expiresAt ? <p className="text-xs text-destructive">{errors.expiresAt.message}</p> : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" className="size-4 rounded border-input" {...register('isActive')} />
            Active coupon
          </label>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleModalOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createCouponMutation.isPending || updateCouponMutation.isPending}
            >
              {createCouponMutation.isPending || updateCouponMutation.isPending
                ? 'Saving...'
                : editingCoupon
                  ? 'Update Coupon'
                  : 'Create Coupon'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
