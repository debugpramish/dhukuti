import { API_BASE_URL, httpRequest, unwrapData } from './httpClient';
import {
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
    shippingRules: normalizeShippingRules(store.shippingRules),
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
