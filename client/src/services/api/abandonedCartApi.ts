import { httpRequest, unwrapData } from './httpClient';
import {
  ABANDONED_CHECKOUT_STATUS_VALUES,
  ABANDONED_REMINDER_STATUS_VALUES,
  ORDER_PAYMENT_METHOD_VALUES,
  type AbandonedCartAnalytics,
  type AbandonedCartAutoReminderResult,
  type AbandonedCheckout,
  type AbandonedCheckoutStatus,
  type AbandonedReminderStatus,
  type OrderPaymentMethod,
} from './types';

type AbandonedCartsPayload = AbandonedCheckout[] | { carts: AbandonedCheckout[]; thresholdMinutes?: number };
type AbandonedCartsResponse = AbandonedCartsPayload | { data: AbandonedCartsPayload };

type AbandonedAnalyticsPayload = AbandonedCartAnalytics | { analytics: AbandonedCartAnalytics };
type AbandonedAnalyticsResponse = AbandonedAnalyticsPayload | { data: AbandonedAnalyticsPayload };

type SendReminderPayload = {
  reminder: {
    status: AbandonedReminderStatus | string;
    message: string;
  };
  cart?: AbandonedCheckout | null;
};
type SendReminderResponse = SendReminderPayload | { data: SendReminderPayload };

type AutoReminderPayload = {
  result: AbandonedCartAutoReminderResult;
  thresholdMinutes: number;
  cooldownMinutes: number;
};
type AutoReminderResponse = AutoReminderPayload | { data: AutoReminderPayload };

const checkoutStatusSet = new Set<string>(ABANDONED_CHECKOUT_STATUS_VALUES);
const reminderStatusSet = new Set<string>(ABANDONED_REMINDER_STATUS_VALUES);
const paymentMethodSet = new Set<string>(ORDER_PAYMENT_METHOD_VALUES);

function toIsoDate(value: unknown): string {
  const parsed = new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizeCheckoutStatus(value: unknown): AbandonedCheckoutStatus {
  const normalized = String(value ?? '').toLowerCase();
  return checkoutStatusSet.has(normalized) ? (normalized as AbandonedCheckoutStatus) : 'open';
}

function normalizeReminderStatus(value: unknown): AbandonedReminderStatus | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value).toLowerCase();
  return reminderStatusSet.has(normalized) ? (normalized as AbandonedReminderStatus) : undefined;
}

function normalizePaymentMethod(value: unknown): OrderPaymentMethod {
  const normalized = String(value ?? '').toLowerCase();
  return paymentMethodSet.has(normalized) ? (normalized as OrderPaymentMethod) : 'cod';
}

function normalizeCheckout(checkout: AbandonedCheckout): AbandonedCheckout {
  return {
    ...checkout,
    customerName: String(checkout.customerName ?? ''),
    customerEmail: String(checkout.customerEmail ?? ''),
    customerPhone: String(checkout.customerPhone ?? ''),
    customerLocation: String(checkout.customerLocation ?? ''),
    subtotal: Number(checkout.subtotal ?? 0),
    productDiscountTotal: Number(checkout.productDiscountTotal ?? 0),
    couponDiscountTotal: Number(checkout.couponDiscountTotal ?? 0),
    discountTotal: Number(checkout.discountTotal ?? 0),
    shippingFee: Number(checkout.shippingFee ?? 0),
    codFee: Number(checkout.codFee ?? 0),
    total: Number(checkout.total ?? 0),
    paymentMethod: normalizePaymentMethod(checkout.paymentMethod),
    status: normalizeCheckoutStatus(checkout.status),
    source: checkout.source === 'payment_initiated' ? 'payment_initiated' : 'preview',
    reminderCount: Number(checkout.reminderCount ?? 0),
    autoReminderCount: Number(checkout.autoReminderCount ?? 0),
    lastReminderSentAt: checkout.lastReminderSentAt ? toIsoDate(checkout.lastReminderSentAt) : undefined,
    lastReminderStatus: normalizeReminderStatus(checkout.lastReminderStatus),
    lastReminderMessage: checkout.lastReminderMessage ? String(checkout.lastReminderMessage) : undefined,
    lastActivityAt: toIsoDate(checkout.lastActivityAt),
    recoveredAt: checkout.recoveredAt ? toIsoDate(checkout.recoveredAt) : undefined,
    createdAt: toIsoDate(checkout.createdAt),
    updatedAt: toIsoDate(checkout.updatedAt),
    items: Array.isArray(checkout.items)
      ? checkout.items.map((item) => ({
          title: String(item.title ?? ''),
          quantity: Number(item.quantity ?? 0),
          unitPrice: Number(item.unitPrice ?? 0),
          sku: item.sku ? String(item.sku) : undefined,
          variantName: item.variantName ? String(item.variantName) : undefined,
        }))
      : [],
  };
}

function normalizeCarts(payload: AbandonedCartsPayload): AbandonedCheckout[] {
  const carts = Array.isArray(payload) ? payload : payload.carts;
  const list = Array.isArray(carts) ? carts : [];
  return list.map(normalizeCheckout);
}

function normalizeAnalytics(payload: AbandonedAnalyticsPayload): AbandonedCartAnalytics {
  const analytics = 'analytics' in payload ? payload.analytics : payload;
  return {
    totalCaptured: Number(analytics.totalCaptured ?? 0),
    abandonedCount: Number(analytics.abandonedCount ?? 0),
    recoveredCount: Number(analytics.recoveredCount ?? 0),
    recoveryRatePercent: Number(analytics.recoveryRatePercent ?? 0),
    potentialRevenue: Number(analytics.potentialRevenue ?? 0),
    recoveredRevenue: Number(analytics.recoveredRevenue ?? 0),
    revenueRecovered: Number(analytics.revenueRecovered ?? 0),
    remindersSent: Number(analytics.remindersSent ?? 0),
    autoRemindersSent: Number(analytics.autoRemindersSent ?? 0),
    thresholdMinutes: Number(analytics.thresholdMinutes ?? 30),
  };
}

function normalizeSendReminder(payload: SendReminderPayload): {
  status: AbandonedReminderStatus;
  message: string;
  cart: AbandonedCheckout | null;
} {
  return {
    status: normalizeReminderStatus(payload.reminder.status) ?? 'simulated',
    message: String(payload.reminder.message ?? ''),
    cart: payload.cart ? normalizeCheckout(payload.cart) : null,
  };
}

function normalizeAutoReminder(payload: AutoReminderPayload): {
  result: AbandonedCartAutoReminderResult;
  thresholdMinutes: number;
  cooldownMinutes: number;
} {
  return {
    result: {
      scanned: Number(payload.result?.scanned ?? 0),
      sent: Number(payload.result?.sent ?? 0),
      simulated: Number(payload.result?.simulated ?? 0),
      failed: Number(payload.result?.failed ?? 0),
    },
    thresholdMinutes: Number(payload.thresholdMinutes ?? 30),
    cooldownMinutes: Number(payload.cooldownMinutes ?? 240),
  };
}

export async function getAbandonedCarts(options: {
  status?: 'open' | 'recovered' | 'all';
  thresholdMinutes?: number;
  limit?: number;
} = {}): Promise<AbandonedCheckout[]> {
  const query = new URLSearchParams();
  if (options.status) {
    query.set('status', options.status);
  }
  if (typeof options.thresholdMinutes === 'number' && Number.isFinite(options.thresholdMinutes)) {
    query.set('thresholdMinutes', String(Math.max(1, Math.floor(options.thresholdMinutes))));
  }
  if (typeof options.limit === 'number' && Number.isFinite(options.limit)) {
    query.set('limit', String(Math.max(1, Math.floor(options.limit))));
  }

  const queryString = query.toString();
  const path = queryString ? `/api/abandoned-carts?${queryString}` : '/api/abandoned-carts';
  const response = await httpRequest<AbandonedCartsResponse>(path, { method: 'GET' });
  return normalizeCarts(unwrapData<AbandonedCartsPayload>(response));
}

export async function getAbandonedCartAnalytics(options: {
  dateFrom?: string;
  dateTo?: string;
  thresholdMinutes?: number;
} = {}): Promise<AbandonedCartAnalytics> {
  const query = new URLSearchParams();
  if (options.dateFrom) {
    query.set('dateFrom', options.dateFrom);
  }
  if (options.dateTo) {
    query.set('dateTo', options.dateTo);
  }
  if (typeof options.thresholdMinutes === 'number' && Number.isFinite(options.thresholdMinutes)) {
    query.set('thresholdMinutes', String(Math.max(1, Math.floor(options.thresholdMinutes))));
  }

  const queryString = query.toString();
  const path = queryString ? `/api/abandoned-carts/analytics?${queryString}` : '/api/abandoned-carts/analytics';
  const response = await httpRequest<AbandonedAnalyticsResponse>(path, { method: 'GET' });
  return normalizeAnalytics(unwrapData<AbandonedAnalyticsPayload>(response));
}

export async function sendAbandonedCartReminder(cartId: string, note?: string): Promise<{
  status: AbandonedReminderStatus;
  message: string;
  cart: AbandonedCheckout | null;
}> {
  const response = await httpRequest<SendReminderResponse>(`/api/abandoned-carts/${cartId}/reminders/send`, {
    method: 'POST',
    body: note ? { note } : {},
  });

  return normalizeSendReminder(unwrapData<SendReminderPayload>(response));
}

export async function runAbandonedCartAutoReminders(payload: {
  thresholdMinutes?: number;
  cooldownMinutes?: number;
  limit?: number;
} = {}): Promise<{
  result: AbandonedCartAutoReminderResult;
  thresholdMinutes: number;
  cooldownMinutes: number;
}> {
  const response = await httpRequest<AutoReminderResponse>('/api/abandoned-carts/reminders/auto', {
    method: 'POST',
    body: payload,
  });

  return normalizeAutoReminder(unwrapData<AutoReminderPayload>(response));
}
