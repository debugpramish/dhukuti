import { httpRequest, unwrapData } from './httpClient';
import {
  STORE_COURIER_VALUES,
  type DiscountType,
  type Product,
  type ProductVariant,
  type PublicStore,
  type ShippingRules,
  type StoreAnalyticsEventInput,
  type StoreContactInput,
} from './types';
import { normalizeAssetUrl, normalizeProductImageUrl } from '@/lib/image';
import { API_BASE_URL } from './httpClient';

type StorePayload = PublicStore | { store: PublicStore };
type ProductsPayload = Product[] | { products: Product[] };

type StoreResponse = StorePayload | { data: StorePayload };
type ProductsResponse = ProductsPayload | { data: ProductsPayload };

type ContactResponse = { message?: string };
type TrackEventsResponse = { message?: string; accepted?: number };

function normalizeShippingRules(rules: PublicStore['shippingRules'] | undefined): ShippingRules {
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

function normalizeStore(payload: StorePayload): PublicStore {
  const store = 'store' in payload ? payload.store : payload;

  return {
    slug: store.slug || '',
    name: store.name || '',
    description: store.description || '',
    phone: store.phone || '',
    address: store.address || '',
    logoUrl: normalizeAssetUrl(store.logoUrl, API_BASE_URL),
    activeTheme: store.activeTheme === 'maison_premium' ? 'maison_premium' : 'classic',
    premiumTheme: {
      unlocked: Boolean(store.premiumTheme?.unlocked),
      unlockedAt: store.premiumTheme?.unlockedAt,
      paymentReference: store.premiumTheme?.paymentReference,
      priceNpr: Math.max(0, Number(store.premiumTheme?.priceNpr ?? 4999)),
    },
    shippingRules: normalizeShippingRules(store.shippingRules),
  };
}

function normalizeProduct(product: Product): Product {
  const price = Number(product.price ?? 0);
  const discountType = normalizeDiscountType(product.discountType);
  const discountValue = Number(product.discountValue ?? 0);
  const discountedPrice = Number(product.discountedPrice ?? calculateDiscountedPrice(price, discountType, discountValue));
  const discountAmount = Number(product.discountAmount ?? Math.max(price - discountedPrice, 0));

  return {
    ...product,
    category: String(product.category ?? '').trim() || 'Uncategorized',
    price,
    discountType,
    discountValue,
    discountedPrice,
    discountAmount,
    hasDiscount: Boolean(product.hasDiscount ?? discountAmount > 0),
    paymentPolicy: product.paymentPolicy === 'PREPAID_ONLY' ? 'PREPAID_ONLY' : 'POSTPAID',
    isFeatured: Boolean(product.isFeatured),
    imageUrl: normalizeProductImageUrl(product.imageUrl, product.title, API_BASE_URL),
    variants: normalizeVariants(product.variants),
  };
}

function normalizeDiscountType(value: string): DiscountType {
  if (value === 'percentage' || value === 'fixed') {
    return value;
  }

  return 'none';
}

function calculateDiscountedPrice(price: number, discountType: DiscountType, discountValue: number): number {
  const normalizedPrice = Number.isFinite(price) ? Math.max(price, 0) : 0;
  const normalizedDiscountValue = Number.isFinite(discountValue) ? Math.max(discountValue, 0) : 0;

  if (discountType === 'percentage') {
    const percentage = Math.min(normalizedDiscountValue, 95);
    return Math.max(0, normalizedPrice - (normalizedPrice * percentage) / 100);
  }

  if (discountType === 'fixed') {
    return Math.max(0, normalizedPrice - normalizedDiscountValue);
  }

  return normalizedPrice;
}

function normalizeVariants(variants: ProductVariant[] | undefined): ProductVariant[] {
  const list = Array.isArray(variants) ? variants : [];
  return list.map((variant) => ({
    ...variant,
    sku: String(variant.sku ?? '').trim(),
    name: String(variant.name ?? ''),
    stock: Number(variant.stock ?? 0),
    lowStockThreshold: Number(variant.lowStockThreshold ?? 0),
    isDefault: Boolean(variant.isDefault),
  }));
}

function normalizeProducts(payload: ProductsPayload): Product[] {
  const products = Array.isArray(payload) ? payload : payload.products;
  const productList = Array.isArray(products) ? products : [];
  return productList.map(normalizeProduct);
}

export async function getPublicStore(slug: string): Promise<PublicStore> {
  const response = await httpRequest<StoreResponse>(`/public/stores/${slug}`, { method: 'GET' });
  return normalizeStore(unwrapData<StorePayload>(response));
}

export async function getPublicStoreProducts(
  slug: string,
  options: { featuredOnly?: boolean; limit?: number } = {},
): Promise<Product[]> {
  const query = new URLSearchParams();

  if (options.featuredOnly) {
    query.set('featured', 'true');
  }

  if (typeof options.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
    query.set('limit', String(Math.floor(options.limit)));
  }

  const queryString = query.toString();
  const path = queryString ? `/public/stores/${slug}/products?${queryString}` : `/public/stores/${slug}/products`;

  const response = await httpRequest<ProductsResponse>(path, { method: 'GET' });
  return normalizeProducts(unwrapData<ProductsPayload>(response));
}

export async function submitStoreContactMessage(slug: string, payload: StoreContactInput): Promise<string> {
  const response = await httpRequest<ContactResponse>(`/public/stores/${slug}/contact`, {
    method: 'POST',
    body: payload,
  });

  return response.message || 'Message sent successfully';
}

export async function trackPublicStoreEvents(
  slug: string,
  payload: {
    sessionId: string;
    trafficSource?: string;
    events: StoreAnalyticsEventInput[];
  },
): Promise<void> {
  await httpRequest<TrackEventsResponse>(`/public/stores/${slug}/analytics/events`, {
    method: 'POST',
    body: payload,
    skipAuth: true,
  });
}
