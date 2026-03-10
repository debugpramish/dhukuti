import { httpRequest, unwrapData } from './httpClient';
import { COUPON_TYPE_VALUES, type Coupon, type CouponCreateInput, type CouponType, type CouponUpdateInput } from './types';

type CouponsPayload = Coupon[] | { coupons: Coupon[] };
type CouponPayload = Coupon | { coupon: Coupon };
type CouponsResponse = CouponsPayload | { data: CouponsPayload };
type CouponResponse = CouponPayload | { data: CouponPayload };

function isCouponType(value: string): value is CouponType {
  return COUPON_TYPE_VALUES.some((couponType) => couponType === value);
}

function normalizeCouponType(value: string): CouponType {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return isCouponType(normalized) ? normalized : 'fixed';
}

function normalizeCoupon(coupon: Coupon): Coupon {
  return {
    ...coupon,
    code: String(coupon.code || '').toUpperCase(),
    type: normalizeCouponType(coupon.type),
    value: Number(coupon.value ?? 0),
    minOrderAmount: Number(coupon.minOrderAmount ?? 0),
    maxDiscountAmount:
      typeof coupon.maxDiscountAmount === 'number' ? Number(coupon.maxDiscountAmount) : undefined,
    isActive: Boolean(coupon.isActive),
    usageLimit: typeof coupon.usageLimit === 'number' ? Number(coupon.usageLimit) : undefined,
    usageCount: Number(coupon.usageCount ?? 0),
    expiresAt: coupon.expiresAt || undefined,
    createdAt: coupon.createdAt || '',
    updatedAt: coupon.updatedAt || '',
  };
}

function normalizeCoupons(payload: CouponsPayload): Coupon[] {
  const coupons = Array.isArray(payload) ? payload : payload.coupons;
  const couponList = Array.isArray(coupons) ? coupons : [];
  return couponList.map(normalizeCoupon);
}

function normalizeSingleCoupon(payload: CouponPayload): Coupon {
  const coupon = 'coupon' in payload ? payload.coupon : payload;
  return normalizeCoupon(coupon);
}

export async function getCoupons(): Promise<Coupon[]> {
  const response = await httpRequest<CouponsResponse>('/api/coupons', {
    method: 'GET',
  });

  return normalizeCoupons(unwrapData<CouponsPayload>(response));
}

export async function createCoupon(payload: CouponCreateInput): Promise<Coupon> {
  const response = await httpRequest<CouponResponse>('/api/coupons', {
    method: 'POST',
    body: payload,
  });

  return normalizeSingleCoupon(unwrapData<CouponPayload>(response));
}

export async function updateCoupon(couponId: string, payload: CouponUpdateInput): Promise<Coupon> {
  const response = await httpRequest<CouponResponse>(`/api/coupons/${couponId}`, {
    method: 'PUT',
    body: payload,
  });

  return normalizeSingleCoupon(unwrapData<CouponPayload>(response));
}

export async function updateCouponActive(couponId: string, isActive: boolean): Promise<Coupon> {
  const response = await httpRequest<CouponResponse>(`/api/coupons/${couponId}/active`, {
    method: 'PATCH',
    body: { isActive },
  });

  return normalizeSingleCoupon(unwrapData<CouponPayload>(response));
}

export async function deleteCoupon(couponId: string): Promise<void> {
  await httpRequest<{ message?: string }>(`/api/coupons/${couponId}`, {
    method: 'DELETE',
  });
}
