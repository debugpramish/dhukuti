import { API_BASE_URL, httpRequest, unwrapData } from './httpClient';
import {
  type PremiumThemePaymentSession,
  STORE_COURIER_VALUES,
  type ShippingRules,
  type StoreSettings,
  type StoreSettingsUpdateInput,
} from './types';
import { normalizeAssetUrl } from '@/lib/image';

type StoreSettingsPayload = StoreSettings | { store: StoreSettings };
type StoreSettingsResponse = StoreSettingsPayload | { data: StoreSettingsPayload };

function normalizeShippingRules(rules: StoreSettings['shippingRules'] | undefined): ShippingRules {
  const supportedCouriers = Array.isArray(rules?.supportedCouriers) && rules.supportedCouriers.length > 0
    ? rules.supportedCouriers
    : [...STORE_COURIER_VALUES];
  const defaultCourier = supportedCouriers.includes(rules?.defaultCourier ?? 'nepal-post')
    ? (rules?.defaultCourier ?? 'nepal-post')
    : supportedCouriers[0];

  return {
    baseFee: Number(rules?.baseFee ?? 100),
    freeShippingAbove: Number(rules?.freeShippingAbove ?? 1000),
    codEnabled: Boolean(rules?.codEnabled ?? true),
    codFee: Number(rules?.codFee ?? 50),
    defaultCourier,
    supportedCouriers,
  };
}

function normalizeStore(payload: StoreSettingsPayload): StoreSettings {
  const store = 'store' in payload ? payload.store : payload;

  return {
    slug: store.slug || '',
    slugChangeCount: Math.max(0, Number(store.slugChangeCount ?? 0)),
    paidSlugChangeCredits: Math.max(0, Number(store.paidSlugChangeCredits ?? 0)),
    requiresSlugChangePayment: Boolean(store.requiresSlugChangePayment),
    name: store.name || '',
    description: store.description || '',
    phone: store.phone || '',
    address: store.address || '',
    logoUrl: normalizeAssetUrl(store.logoUrl, API_BASE_URL),
    activeTheme: store.activeTheme === 'maison_premium' ? 'maison_premium' : 'classic',
    premiumTheme: {
      unlocked: Boolean(store.premiumTheme?.unlocked),
      unlockedAt: typeof store.premiumTheme?.unlockedAt === 'string' ? store.premiumTheme.unlockedAt : undefined,
      paymentReference:
        typeof store.premiumTheme?.paymentReference === 'string' ? store.premiumTheme.paymentReference : undefined,
      priceNpr: Math.max(0, Number(store.premiumTheme?.priceNpr ?? 4999)),
    },
    shippingRules: normalizeShippingRules(store.shippingRules),
  };
}

function normalizeThemePayment(payload: unknown): PremiumThemePaymentSession {
  const record = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
  const provider = String(record.provider || '').toLowerCase() === 'khalti' ? 'khalti' : 'esewa';

  return {
    provider,
    paymentSessionId: String(record.paymentSessionId || ''),
    status: String(record.status || '').toLowerCase() === 'verified' ? 'verified' : 'initiated',
    amount: Math.max(0, Number(record.amount ?? 0)),
    expiresAt: typeof record.expiresAt === 'string' ? record.expiresAt : undefined,
    paymentReference: typeof record.paymentReference === 'string' ? record.paymentReference : undefined,
  };
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const response = await httpRequest<StoreSettingsResponse>('/api/store/settings', {
    method: 'GET',
  });

  return normalizeStore(unwrapData<StoreSettingsPayload>(response));
}

export async function updateStoreSettings(payload: StoreSettingsUpdateInput): Promise<StoreSettings> {
  const response = await httpRequest<StoreSettingsResponse>('/api/store/settings', {
    method: 'PUT',
    body: payload,
  });

  return normalizeStore(unwrapData<StoreSettingsPayload>(response));
}

export async function uploadStoreLogo(file: File): Promise<StoreSettings> {
  const formData = new FormData();
  formData.append('logo', file);

  const response = await httpRequest<StoreSettingsResponse>('/api/store/settings/logo', {
    method: 'PUT',
    body: formData,
  });

  return normalizeStore(unwrapData<StoreSettingsPayload>(response));
}

export async function initiatePremiumThemePayment(provider: 'esewa' | 'khalti'): Promise<PremiumThemePaymentSession> {
  const response = await httpRequest<{ payment: unknown }>('/api/store/themes/maison-premium/initiate', {
    method: 'POST',
    body: { provider },
  });

  const payload = unwrapData<{ payment?: unknown }>(response);
  return normalizeThemePayment(payload.payment || {});
}

export async function verifyAndActivatePremiumTheme(paymentSessionId: string): Promise<{
  payment: PremiumThemePaymentSession;
  store: StoreSettings;
}> {
  const response = await httpRequest<{ payment: unknown; store: StoreSettingsPayload }>(
    '/api/store/themes/maison-premium/verify-and-activate',
    {
      method: 'POST',
      body: { paymentSessionId },
    },
  );

  const payload = unwrapData<{ payment?: unknown; store?: StoreSettingsPayload }>(response);
  const fallbackStore: StoreSettingsPayload = {
    store: {
      slug: '',
      slugChangeCount: 0,
      paidSlugChangeCredits: 0,
      requiresSlugChangePayment: false,
      name: '',
      description: '',
      phone: '',
      address: '',
      activeTheme: 'classic',
      premiumTheme: {
        unlocked: false,
        priceNpr: 4999,
      },
      shippingRules: normalizeShippingRules(undefined),
    },
  };

  return {
    payment: normalizeThemePayment(payload.payment || {}),
    store: normalizeStore(payload.store || fallbackStore),
  };
}
