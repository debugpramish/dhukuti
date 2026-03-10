import { API_BASE_URL } from '@/services/api/httpClient';
import { getAuthToken as getMerchantAuthToken } from '@/lib/auth';
import { buildProductPlaceholderImage, normalizeProductImageUrl } from '@/lib/image';
import type {
  AuthResponse,
  CmsPage,
  CheckoutBill,
  CheckoutPayload,
  CheckoutResponse,
  CustomerOrder,
  LoginInput,
  ProductAvailability,
  ProductCategory,
  ProductQueryInput,
  ProductQueryMeta,
  ProductQueryResult,
  ProductReview,
  ProductVariant,
  RegisterInput,
  SearchSuggestion,
  ShippingAddress,
  StorefrontStore,
  StorefrontProduct,
} from '@/features/storefront/types';

type UnknownRecord = Record<string, unknown>;

type RequestInitWithAuth = RequestInit & {
  token?: string;
};

const DEFAULT_PAGE_SIZE = 20;
const ENV_STOREFRONT_SLUG = String(import.meta.env.VITE_STOREFRONT_SLUG || '').trim().toLowerCase();
const ENV_STOREFRONT_NAME = String(import.meta.env.VITE_STOREFRONT_NAME || '').trim();
const STOREFRONT_SLUG_STORAGE_KEY = 'dhukuti:storefront:slug';
const API_V1_PREFIX = '/api/v1';

let cachedStoreSlug = ENV_STOREFRONT_SLUG || '';
let cachedStore: StorefrontStore | null = null;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function normalizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered === 'true') {
      return true;
    }

    if (lowered === 'false') {
      return false;
    }
  }

  return fallback;
}

function normalizeStoreSlug(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

function normalizeStore(payload: unknown): StorefrontStore | null {
  const raw = isRecord(payload) ? payload : {};
  const slug = normalizeStoreSlug(raw.slug);
  const name = normalizeString(raw.name || ENV_STOREFRONT_NAME);

  if (!slug || !name) {
    return null;
  }

  return {
    slug,
    name,
    description: normalizeString(raw.description),
    phone: normalizeString(raw.phone),
    address: normalizeString(raw.address),
    logoUrl: normalizeString(raw.logoUrl) || undefined,
    shippingRules: isRecord(raw.shippingRules)
      ? {
          baseFee: Math.max(0, normalizeNumber(raw.shippingRules.baseFee, 100)),
          freeShippingAbove: Math.max(0, normalizeNumber(raw.shippingRules.freeShippingAbove, 1000)),
          codEnabled: normalizeBoolean(raw.shippingRules.codEnabled, true),
          codFee: Math.max(0, normalizeNumber(raw.shippingRules.codFee, 50)),
          defaultCourier: normalizeString(raw.shippingRules.defaultCourier, 'nepal-post'),
          supportedCouriers: Array.isArray(raw.shippingRules.supportedCouriers)
            ? raw.shippingRules.supportedCouriers
                .map((entry) => normalizeString(entry))
                .filter(Boolean)
            : ['nepal-post', 'pathao', 'delivery-sathi'],
        }
      : undefined,
  };
}

function toTitleSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function normalizeAvailability(value: unknown, stock: number): ProductAvailability {
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered === 'in_stock' || lowered === 'out_of_stock' || lowered === 'preorder') {
      return lowered;
    }
  }

  return stock > 0 ? 'in_stock' : 'out_of_stock';
}

function normalizeVariant(value: unknown): ProductVariant | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeString(value.id || value._id || value.sku);
  const optionName = normalizeString(value.name || value.option || 'Variant');
  const optionValue = normalizeString(value.value || value.label || optionName);

  if (!id || !optionValue) {
    return null;
  }

  return {
    id,
    name: optionName,
    value: optionValue,
    sku: normalizeString(value.sku || value.code) || undefined,
    stock: normalizeOptionalNumber(value.stock),
    priceDelta: normalizeOptionalNumber(value.priceDelta || value.price_delta),
    isDefault: normalizeBoolean(value.isDefault || value.default),
  };
}

function normalizeReview(value: unknown): ProductReview | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeString(value.id || value._id);
  const content = normalizeString(value.content || value.comment || value.message);

  if (!id || !content) {
    return null;
  }

  const rating = Math.max(1, Math.min(5, Math.round(normalizeNumber(value.rating, 5))));

  return {
    id,
    author: normalizeString(value.author || value.customerName || value.name, 'Customer'),
    rating,
    title: normalizeString(value.title) || undefined,
    content,
    createdAt: normalizeString(value.createdAt || value.date, new Date().toISOString()),
  };
}

function pickProductImages(raw: UnknownRecord, title: string): string[] {
  const explicit = Array.isArray(raw.images)
    ? raw.images.map((item) => normalizeString(item)).filter(Boolean)
    : [];
  const imageUrl = normalizeString(raw.image || raw.imageUrl || raw.thumbnail);

  const images = explicit.length > 0 ? explicit : imageUrl ? [imageUrl] : [buildProductPlaceholderImage(title)];
  return images.map((image) => normalizeProductImageUrl(image, title, API_BASE_URL));
}

function normalizeProduct(payload: unknown): StorefrontProduct {
  const raw = isRecord(payload) ? payload : {};
  const id = normalizeString(raw.id || raw._id || raw.slug || raw.title);
  const title = normalizeString(raw.title || raw.name || 'Untitled Product');
  const slug = normalizeString(raw.slug) || (id ? toTitleSlug(id) : toTitleSlug(title));
  const description = normalizeString(raw.description || raw.details || raw.summary);
  const basePrice = normalizeNumber(raw.price || raw.originalPrice || raw.mrp, 0);
  const discountedPrice = normalizeNumber(raw.discountedPrice || raw.salePrice, basePrice);
  const compareAtPrice = normalizeNumber(raw.compareAtPrice || raw.originalPrice || basePrice, basePrice);
  const price = discountedPrice > 0 ? discountedPrice : basePrice;
  const discountPercent = compareAtPrice > price ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : 0;
  const stock = Math.max(0, normalizeNumber(raw.stock || raw.quantity || raw.inventory, 0));

  const ratingAverage = normalizeNumber(
    (isRecord(raw.rating) ? raw.rating.average : undefined) || raw.averageRating || raw.rating,
    0,
  );
  const ratingCount = normalizeNumber((isRecord(raw.rating) ? raw.rating.count : undefined) || raw.reviewCount, 0);

  const variants = Array.isArray(raw.variants)
    ? raw.variants
        .map((variant) => normalizeVariant(variant))
        .filter((variant): variant is ProductVariant => variant !== null)
    : [];
  const reviews = Array.isArray(raw.reviews)
    ? raw.reviews.map((review) => normalizeReview(review)).filter((review): review is ProductReview => review !== null)
    : [];
  const tags = Array.isArray(raw.tags) ? raw.tags.map((tag) => normalizeString(tag)).filter(Boolean) : [];

  const images = pickProductImages(raw, title);

  return {
    id,
    slug,
    title,
    description,
    shortDescription: normalizeString(raw.shortDescription || raw.subtitle) || undefined,
    category: normalizeString(raw.category, 'Uncategorized'),
    price,
    compareAtPrice: compareAtPrice > price ? compareAtPrice : undefined,
    discountPercent: discountPercent > 0 ? discountPercent : undefined,
    thumbnail: images[0],
    images,
    rating: {
      average: Math.max(0, Math.min(5, ratingAverage)),
      count: Math.max(0, Math.round(ratingCount)),
    },
    availability: normalizeAvailability(raw.availability || raw.status, stock),
    stock,
    isFeatured: normalizeBoolean(raw.isFeatured || raw.featured),
    isTrending: normalizeBoolean(raw.isTrending || raw.trending),
    isBestSeller: normalizeBoolean(raw.isBestSeller || raw.bestSeller),
    variants,
    reviews,
    tags,
  };
}

function extractArrayPayload(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  const nestedData = 'data' in payload ? (payload as { data?: unknown }).data : payload;

  if (Array.isArray(nestedData)) {
    return nestedData;
  }

  if (!isRecord(nestedData)) {
    return [];
  }

  for (const key of keys) {
    const candidate = nestedData[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function extractObjectPayload(payload: unknown, keys: string[]): UnknownRecord {
  if (isRecord(payload)) {
    const nestedData = 'data' in payload && isRecord(payload.data) ? payload.data : payload;

    if (isRecord(nestedData)) {
      for (const key of keys) {
        if (isRecord(nestedData[key])) {
          return nestedData[key] as UnknownRecord;
        }
      }

      return nestedData;
    }
  }

  return {};
}

function extractMeta(payload: unknown, fallbackPage: number, fallbackLimit: number, totalItems: number): ProductQueryMeta {
  if (isRecord(payload)) {
    const data = isRecord(payload.data) ? payload.data : payload;
    const meta = isRecord(data.meta)
      ? data.meta
      : isRecord(data.pagination)
        ? data.pagination
        : {};

    const page = Math.max(1, normalizeNumber(meta.page, fallbackPage));
    const limit = Math.max(1, normalizeNumber(meta.limit, fallbackLimit));
    const total = Math.max(totalItems, normalizeNumber(meta.total || meta.totalItems, totalItems));
    const totalPages = Math.max(1, normalizeNumber(meta.totalPages, Math.ceil(total / limit)));

    return {
      page,
      limit,
      total,
      totalPages,
    };
  }

  return {
    page: fallbackPage,
    limit: fallbackLimit,
    total: totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / fallbackLimit)),
  };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

async function storefrontRequest<T>(path: string, init: RequestInitWithAuth = {}): Promise<T> {
  const normalizedPath = normalizeStorefrontPath(path);
  const headers = new Headers(init.headers);

  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (init.token) {
    headers.set('Authorization', `Bearer ${init.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...init,
    headers,
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const message = isRecord(payload) ? normalizeString(payload.message, 'Request failed') : 'Request failed';
    throw new Error(message);
  }

  return payload as T;
}

function normalizeStorefrontPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Avoid duplicating /api/v1 when API_BASE_URL already includes the same prefix.
  if (API_BASE_URL.endsWith(API_V1_PREFIX) && normalizedPath.startsWith(`${API_V1_PREFIX}/`)) {
    return normalizedPath.slice(API_V1_PREFIX.length);
  }

  return normalizedPath;
}

async function requestWithFallback<T>(paths: string[], init?: RequestInitWithAuth): Promise<T> {
  let lastError: Error | null = null;

  for (const path of paths) {
    try {
      return await storefrontRequest<T>(path, init);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Request failed');
    }
  }

  throw lastError ?? new Error('Request failed');
}

function persistStoreSlug(slug: string) {
  if (typeof window === 'undefined' || !slug) {
    return;
  }

  try {
    window.localStorage.setItem(STOREFRONT_SLUG_STORAGE_KEY, slug);
  } catch {
    // Ignore storage write failures.
  }
}

function readStoreSlugFromStorage(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return normalizeStoreSlug(window.localStorage.getItem(STOREFRONT_SLUG_STORAGE_KEY) || '');
  } catch {
    return '';
  }
}

function readStoreSlugFromUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const params = new URLSearchParams(window.location.search);
    return normalizeStoreSlug(params.get('store'));
  } catch {
    return '';
  }
}

async function resolveStoreSlugFromMerchantSession(): Promise<string> {
  const merchantToken = getMerchantAuthToken();
  if (!merchantToken) {
    return '';
  }

  try {
    const response = await storefrontRequest<unknown>('/api/v1/store/settings', {
      method: 'GET',
      token: merchantToken,
    });
    const payload = extractObjectPayload(response, ['store', 'settings', 'data']);
    const slug = normalizeStoreSlug(payload.slug);
    return slug;
  } catch {
    return '';
  }
}

async function resolveStoreSlug(): Promise<string> {
  const storeSlugFromUrl = readStoreSlugFromUrl();
  if (storeSlugFromUrl) {
    if (cachedStoreSlug && cachedStoreSlug !== storeSlugFromUrl) {
      cachedStore = null;
    }
    cachedStoreSlug = storeSlugFromUrl;
    persistStoreSlug(cachedStoreSlug);
    return cachedStoreSlug;
  }

  if (cachedStoreSlug) {
    return cachedStoreSlug;
  }

  const storedSlug = readStoreSlugFromStorage();
  if (storedSlug) {
    cachedStoreSlug = storedSlug;
    return cachedStoreSlug;
  }

  if (ENV_STOREFRONT_SLUG) {
    cachedStoreSlug = ENV_STOREFRONT_SLUG;
    persistStoreSlug(cachedStoreSlug);
    return cachedStoreSlug;
  }

  const merchantStoreSlug = await resolveStoreSlugFromMerchantSession();
  if (merchantStoreSlug) {
    cachedStoreSlug = merchantStoreSlug;
    persistStoreSlug(cachedStoreSlug);
    return cachedStoreSlug;
  }

  const payload = await storefrontRequest<unknown>('/api/v1/public/stores?limit=1', { method: 'GET' });
  const stores = extractArrayPayload(payload, ['stores', 'items']);
  const firstStore = stores[0];
  const normalizedStore = normalizeStore(firstStore);

  if (!normalizedStore) {
    throw new Error(
      'No storefront store is configured. Create a merchant store in the dashboard or set VITE_STOREFRONT_SLUG.',
    );
  }

  cachedStoreSlug = normalizedStore.slug;
  cachedStore = normalizedStore;
  persistStoreSlug(cachedStoreSlug);
  return cachedStoreSlug;
}

async function resolveStore(): Promise<StorefrontStore> {
  if (cachedStore) {
    return cachedStore;
  }

  const slug = await resolveStoreSlug();
  const payload = await storefrontRequest<unknown>(`/api/v1/public/stores/${encodeURIComponent(slug)}`, {
    method: 'GET',
  });
  const storePayload = extractObjectPayload(payload, ['store', 'item']);
  const normalizedStore = normalizeStore(storePayload);

  if (!normalizedStore) {
    throw new Error('Unable to load storefront information');
  }

  cachedStore = normalizedStore;
  cachedStoreSlug = normalizedStore.slug;
  return normalizedStore;
}

function toQueryString(params: ProductQueryInput): string {
  const query = new URLSearchParams();

  if (params.page) {
    query.set('page', String(params.page));
  }

  if (params.limit) {
    query.set('limit', String(params.limit));
  }

  if (params.category) {
    query.set('category', params.category);
  }

  if (typeof params.minPrice === 'number') {
    query.set('minPrice', String(params.minPrice));
  }

  if (typeof params.maxPrice === 'number') {
    query.set('maxPrice', String(params.maxPrice));
  }

  if (typeof params.rating === 'number') {
    query.set('rating', String(params.rating));
  }

  if (params.availability) {
    query.set('availability', params.availability);
  }

  if (params.sort) {
    query.set('sort', params.sort);
  }

  if (params.featured) {
    query.set('featured', 'true');
  }

  if (params.trending) {
    query.set('trending', 'true');
  }

  if (params.bestSeller) {
    query.set('bestSeller', 'true');
  }

  if (params.query) {
    query.set('q', params.query);
  }

  return query.toString();
}

function normalizeAddress(payload: unknown): ShippingAddress {
  const raw = isRecord(payload) ? payload : {};
  const location = normalizeString(raw.customerLocation || raw.location);
  const rawAddress = normalizeString(raw.address || raw.street);
  const fallbackAddress = rawAddress || location;

  return {
    name: normalizeString(raw.name || raw.fullName),
    email: normalizeString(raw.email),
    phone: normalizeString(raw.phone),
    address: fallbackAddress,
    city: normalizeString(raw.city),
    postalCode: normalizeString(raw.postalCode || raw.zipCode || raw.zip),
    country: normalizeString(raw.country || 'Nepal'),
  };
}

function normalizeOrder(payload: unknown): CustomerOrder {
  const raw = isRecord(payload) ? payload : {};

  const items = extractArrayPayload(raw.items || raw.orderItems || raw.lines, ['items']).map((item) => {
    const row = isRecord(item) ? item : {};
    const quantity = Math.max(1, normalizeNumber(row.quantity, 1));
    const unitPrice = Math.max(0, normalizeNumber(row.unitPrice || row.price, 0));

    return {
      id: normalizeString(row.id || row._id || row.productId || row.sku || row.title),
      productId: normalizeString(row.productId) || undefined,
      title: normalizeString(row.title || row.name || 'Product'),
      quantity,
      unitPrice,
      subtotal: Math.max(0, normalizeNumber(row.subtotal, quantity * unitPrice)),
      image: normalizeString(row.image || row.imageUrl || row.thumbnail) || undefined,
      variantLabel: normalizeString(row.variantLabel || row.variantName) || undefined,
    };
  });

  const shippingAddress = normalizeAddress(
    raw.shippingAddress ||
      raw.address ||
      raw.deliveryAddress || {
        name: raw.customerName,
        email: raw.customerEmail,
        phone: raw.customerPhone,
        address: raw.customerLocation,
      },
  );
  const subtotal = Math.max(0, normalizeNumber(raw.subtotal, items.reduce((sum, item) => sum + item.subtotal, 0)));
  const discountTotal = Math.max(0, normalizeNumber(raw.discountTotal || raw.couponDiscountTotal, 0));
  const shipping = Math.max(0, normalizeNumber(raw.shipping || raw.shippingFee, 0));
  const tax = Math.max(0, normalizeNumber(raw.tax || raw.taxTotal, 0));
  const total = Math.max(0, normalizeNumber(raw.total, subtotal - discountTotal + shipping + tax));

  return {
    id: normalizeString(raw.id || raw._id || raw.orderId),
    orderNumber: normalizeString(raw.orderNumber || raw.number || raw.id),
    status: normalizeString(raw.status || 'pending'),
    createdAt: normalizeString(raw.createdAt || new Date().toISOString()),
    paymentMethod: normalizeString(raw.paymentMethod || 'cod'),
    estimatedDelivery: normalizeString(raw.estimatedDelivery || raw.eta) || undefined,
    shippingAddress,
    items,
    payment: {
      subtotal,
      discountTotal,
      shipping,
      tax,
      total,
    },
  };
}

function normalizeCheckoutBill(payload: unknown): CheckoutBill {
  const raw = isRecord(payload) ? payload : {};

  const paymentMethodRaw = normalizeString(raw.paymentMethod || 'cod').toLowerCase();
  const paymentMethod: CheckoutBill['paymentMethod'] =
    paymentMethodRaw === 'esewa' || paymentMethodRaw === 'khalti' ? paymentMethodRaw : 'cod';

  return {
    subtotal: Math.max(0, normalizeNumber(raw.subtotal, 0)),
    productDiscountTotal: Math.max(0, normalizeNumber(raw.productDiscountTotal, 0)),
    couponCode: normalizeString(raw.couponCode) || undefined,
    couponDiscountTotal: Math.max(0, normalizeNumber(raw.couponDiscountTotal, 0)),
    discountTotal: Math.max(0, normalizeNumber(raw.discountTotal, 0)),
    shippingFee: Math.max(0, normalizeNumber(raw.shippingFee, 0)),
    codFee: Math.max(0, normalizeNumber(raw.codFee, 0)),
    paymentMethod,
    total: Math.max(0, normalizeNumber(raw.total, 0)),
  };
}

function buildCustomerLocation(address: ShippingAddress): string {
  return [address.address, address.city, address.postalCode, address.country]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(', ');
}

function normalizeAuth(payload: unknown): AuthResponse {
  const responseRecord = isRecord(payload) ? payload : {};
  const dataRecord = isRecord(responseRecord.data) ? responseRecord.data : responseRecord;
  const userRecord = isRecord(dataRecord.user)
    ? dataRecord.user
    : isRecord(responseRecord.user)
      ? responseRecord.user
      : {};
  const token = normalizeString(dataRecord.token || responseRecord.token);

  if (!token) {
    throw new Error('Authentication failed: token missing from API response');
  }

  const normalizedAddresses = Array.isArray(userRecord.addresses)
    ? userRecord.addresses.map((address) => normalizeAddress(address))
    : normalizeString(userRecord.address)
      ? [
          {
            name: normalizeString(userRecord.name || userRecord.fullName),
            email: normalizeString(userRecord.email),
            phone: normalizeString(userRecord.phone),
            address: normalizeString(userRecord.address),
            city: '',
            postalCode: '',
            country: 'Nepal',
          } satisfies ShippingAddress,
        ]
      : undefined;

  return {
    token,
    user: {
      id: normalizeString(userRecord.id || userRecord._id || userRecord.email),
      name: normalizeString(userRecord.name || userRecord.fullName),
      email: normalizeString(userRecord.email),
      phone: normalizeString(userRecord.phone) || undefined,
      addresses: normalizedAddresses,
    },
  };
}

export async function fetchProducts(params: ProductQueryInput = {}): Promise<ProductQueryResult> {
  const storeSlug = await resolveStoreSlug();
  const query = toQueryString(params);
  const endpoint = query
    ? `/api/v1/public/stores/${encodeURIComponent(storeSlug)}/products?${query}`
    : `/api/v1/public/stores/${encodeURIComponent(storeSlug)}/products`;

  const payload = await storefrontRequest<unknown>(endpoint, { method: 'GET' });
  const rawItems = extractArrayPayload(payload, ['items', 'products', 'results']);
  const items = rawItems.map((item) => normalizeProduct(item));

  return {
    items,
    meta: extractMeta(payload, params.page ?? 1, params.limit ?? DEFAULT_PAGE_SIZE, items.length),
  };
}

export async function fetchFeaturedProducts(limit = 8): Promise<StorefrontProduct[]> {
  const result = await fetchProducts({ featured: true, limit, sort: 'newest' });
  return result.items;
}

export async function fetchTrendingProducts(limit = 8): Promise<StorefrontProduct[]> {
  const result = await fetchProducts({ trending: true, limit, sort: 'popular' });
  return result.items;
}

export async function fetchBestSellerProducts(limit = 8): Promise<StorefrontProduct[]> {
  const result = await fetchProducts({ bestSeller: true, limit, sort: 'best_seller' });
  return result.items;
}

export async function fetchProductBySlug(slug: string): Promise<StorefrontProduct> {
  if (!slug.trim()) {
    throw new Error('Invalid product slug');
  }

  const storeSlug = await resolveStoreSlug();
  const payload = await storefrontRequest<unknown>(
    `/api/v1/public/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(slug)}`,
    {
      method: 'GET',
    },
  );

  const productPayload = extractObjectPayload(payload, ['product', 'item']);
  return normalizeProduct(productPayload);
}

export async function fetchRelatedProducts(slug: string, limit = 4): Promise<StorefrontProduct[]> {
  try {
    const current = await fetchProductBySlug(slug);
    const fallback = await fetchProducts({ category: current.category, limit: limit + 1, sort: 'popular' });
    return fallback.items.filter((item) => item.slug !== slug).slice(0, limit);
  } catch {
    return [];
  }
}

export async function searchProducts(query: string, limit = 20): Promise<StorefrontProduct[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  const storeSlug = await resolveStoreSlug();
  const payload = await storefrontRequest<unknown>(
    `/api/v1/public/stores/${encodeURIComponent(storeSlug)}/products?q=${encodeURIComponent(normalizedQuery)}&limit=${limit}`,
    {
      method: 'GET',
    },
  );

  const rawItems = extractArrayPayload(payload, ['items', 'products', 'results']);
  return rawItems.map((item) => normalizeProduct(item));
}

export async function fetchSearchSuggestions(query: string, limit = 6): Promise<SearchSuggestion[]> {
  const products = await searchProducts(query, limit);

  return products.slice(0, limit).map((product) => ({
    id: product.id,
    slug: product.slug,
    title: product.title,
    thumbnail: product.thumbnail,
    price: product.price,
  }));
}

export async function fetchProductCategories(): Promise<ProductCategory[]> {
  const result = await fetchProducts({ limit: 100, sort: 'popular', page: 1 });
  const categoriesMap = new Map<string, ProductCategory>();

  for (const product of result.items) {
    const key = product.category.trim() || 'Uncategorized';
    const existing = categoriesMap.get(key);

    if (existing) {
      existing.productCount = (existing.productCount || 0) + 1;
      continue;
    }

    categoriesMap.set(key, {
      key,
      label: key,
      image: product.thumbnail,
      productCount: 1,
    });
  }

  return Array.from(categoriesMap.values()).sort((a, b) => (b.productCount || 0) - (a.productCount || 0));
}

export async function fetchStorefrontStore(): Promise<StorefrontStore> {
  return resolveStore();
}

export async function loginCustomer(payload: LoginInput): Promise<AuthResponse> {
  const response = await requestWithFallback<unknown>(
    ['/api/v1/auth/customer/login', '/auth/customer/login', '/api/v1/auth/login'],
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  return normalizeAuth(response);
}

export async function registerCustomer(payload: RegisterInput): Promise<AuthResponse> {
  const signupPayload = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    address: payload.address,
    password: payload.password,
    confirmPassword: payload.password,
  };

  const response = await requestWithFallback<unknown>(
    ['/api/v1/auth/customer/signup', '/auth/customer/signup', '/api/v1/auth/signup'],
    {
      method: 'POST',
      body: JSON.stringify(signupPayload),
    },
  );

  return normalizeAuth(response);
}

export async function createOrder(payload: CheckoutPayload, token: string): Promise<CheckoutResponse> {
  const storeSlug = await resolveStoreSlug();
  const paymentMethod: 'cod' | 'esewa' | 'khalti' =
    payload.paymentMethod === 'esewa' || payload.paymentMethod === 'khalti' || payload.paymentMethod === 'cod'
      ? payload.paymentMethod
      : 'cod';

  const response = await storefrontRequest<unknown>(
    `/api/v1/public/stores/${encodeURIComponent(storeSlug)}/orders`,
    {
      method: 'POST',
      body: JSON.stringify({
        customerName: payload.shippingAddress.name,
        customerPhone: payload.shippingAddress.phone,
        customerLocation: buildCustomerLocation(payload.shippingAddress),
        items: payload.items,
        paymentMethod,
        ...(payload.couponCode ? { couponCode: payload.couponCode } : {}),
        ...(payload.paymentSessionId ? { paymentSessionId: payload.paymentSessionId } : {}),
      }),
      token,
    },
  );

  const data = extractObjectPayload(response, ['order', 'data']);
  const id = normalizeString(data.id || data.orderId || (isRecord(response) ? (response as UnknownRecord).orderId : ''));
  const orderId = id || normalizeString(data.orderNumber);

  if (!orderId) {
    throw new Error('Order created but order ID missing in response');
  }

  return {
    id,
    orderId,
    orderNumber: normalizeString(data.orderNumber) || undefined,
  };
}

export async function previewCheckoutBill(payload: CheckoutPayload, token: string): Promise<CheckoutBill> {
  const storeSlug = await resolveStoreSlug();
  const paymentMethod: 'cod' | 'esewa' | 'khalti' =
    payload.paymentMethod === 'esewa' || payload.paymentMethod === 'khalti' || payload.paymentMethod === 'cod'
      ? payload.paymentMethod
      : 'cod';

  const response = await storefrontRequest<unknown>(
    `/api/v1/public/stores/${encodeURIComponent(storeSlug)}/orders/preview`,
    {
      method: 'POST',
      body: JSON.stringify({
        customerName: payload.shippingAddress.name,
        customerPhone: payload.shippingAddress.phone,
        customerLocation: buildCustomerLocation(payload.shippingAddress),
        items: payload.items,
        paymentMethod,
        ...(payload.couponCode ? { couponCode: payload.couponCode } : {}),
      }),
      token,
    },
  );

  const billPayload = extractObjectPayload(response, ['bill', 'data']);
  return normalizeCheckoutBill(billPayload);
}

export async function initiateStorePayment(payload: CheckoutPayload, token: string): Promise<{
  paymentSessionId: string;
  paymentReference?: string;
  bill: CheckoutBill;
}> {
  const storeSlug = await resolveStoreSlug();
  const provider = payload.paymentMethod === 'esewa' || payload.paymentMethod === 'khalti' ? payload.paymentMethod : null;

  if (!provider) {
    throw new Error('Online payment is only available for eSewa and Khalti.');
  }

  const response = await storefrontRequest<unknown>(
    `/api/v1/public/stores/${encodeURIComponent(storeSlug)}/payments/${provider}/initiate`,
    {
      method: 'POST',
      body: JSON.stringify({
        customerName: payload.shippingAddress.name,
        customerPhone: payload.shippingAddress.phone,
        customerLocation: buildCustomerLocation(payload.shippingAddress),
        items: payload.items,
        paymentMethod: provider,
        ...(payload.couponCode ? { couponCode: payload.couponCode } : {}),
      }),
      token,
    },
  );

  const data = isRecord(response)
    ? (isRecord(response.data) ? (response.data as UnknownRecord) : response)
    : {};
  const paymentPayload = extractObjectPayload(data.payment, ['payment']);
  const billPayload = extractObjectPayload(data.bill, ['bill']);
  const paymentSessionId = normalizeString(paymentPayload.paymentSessionId || paymentPayload.id);

  if (!paymentSessionId) {
    throw new Error('Payment session could not be created');
  }

  return {
    paymentSessionId,
    paymentReference: normalizeString(paymentPayload.paymentReference) || undefined,
    bill: normalizeCheckoutBill(billPayload),
  };
}

export async function verifyStorePayment(paymentSessionId: string, token: string): Promise<{
  verified: boolean;
  paymentReference?: string;
}> {
  const storeSlug = await resolveStoreSlug();

  const response = await storefrontRequest<unknown>(
    `/api/v1/public/stores/${encodeURIComponent(storeSlug)}/payments/verify`,
    {
      method: 'POST',
      body: JSON.stringify({ paymentSessionId }),
      token,
    },
  );

  const data = isRecord(response)
    ? (isRecord(response.data) ? (response.data as UnknownRecord) : response)
    : {};
  const paymentPayload = extractObjectPayload(data.payment, ['payment']);
  const status = normalizeString(paymentPayload.status || '');

  return {
    verified: status === 'verified',
    paymentReference: normalizeString(paymentPayload.paymentReference) || undefined,
  };
}

export async function fetchCustomerOrders(token: string): Promise<CustomerOrder[]> {
  const response = await storefrontRequest<unknown>('/api/v1/orders/customer', {
    method: 'GET',
    token,
  });

  const orders = extractArrayPayload(response, ['orders', 'items', 'results']);
  return orders.map((order) => normalizeOrder(order));
}

export async function fetchOrderById(orderId: string, token?: string): Promise<CustomerOrder> {
  const response = await storefrontRequest<unknown>(`/api/v1/orders/${orderId}`, {
    method: 'GET',
    token,
  });

  const data = extractObjectPayload(response, ['order', 'item']);
  const normalized = normalizeOrder(data);

  if (!normalized.id && !normalized.orderNumber) {
    throw new Error('Order not found');
  }

  if (!normalized.id) {
    normalized.id = orderId;
  }

  if (!normalized.orderNumber) {
    normalized.orderNumber = orderId;
  }

  return normalized;
}

export async function fetchPageBySlug(slug: string): Promise<CmsPage> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    throw new Error('Invalid page slug');
  }

  const response = await storefrontRequest<unknown>(`/api/v1/public/pages/${normalizedSlug}`, {
    method: 'GET',
  });

  const payload = extractObjectPayload(response, ['page', 'item', 'data']);
  const title = normalizeString(payload.title || payload.name || normalizedSlug);
  const body = normalizeString(payload.body || payload.content || payload.description);

  if (!title || !body) {
    throw new Error('Invalid page response');
  }

  return {
    slug: normalizedSlug,
    title,
    seoTitle: normalizeString(payload.seoTitle) || undefined,
    seoDescription: normalizeString(payload.seoDescription || payload.metaDescription) || undefined,
    body,
  };
}

export async function submitStoreContactMessage(payload: {
  name: string;
  email: string;
  message: string;
}): Promise<{ message: string }> {
  const storeSlug = await resolveStoreSlug();

  const response = await storefrontRequest<unknown>(
    `/api/v1/public/stores/${encodeURIComponent(storeSlug)}/contact`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name.trim(),
        email: payload.email.trim(),
        message: payload.message.trim(),
      }),
    },
  );

  const data = isRecord(response) ? response : {};
  return {
    message: normalizeString(data.message, 'Message sent successfully'),
  };
}

export async function validateCoupon(code: string, total: number, token?: string): Promise<{
  valid: boolean;
  discountAmount: number;
  message: string;
}> {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    return {
      valid: false,
      discountAmount: 0,
      message: 'Enter a coupon code',
    };
  }

  try {
    const storeSlug = await resolveStoreSlug();
    const response = await storefrontRequest<unknown>(
      `/api/v1/public/stores/${encodeURIComponent(storeSlug)}/coupons/validate`,
      {
      method: 'POST',
      body: JSON.stringify({ code: normalizedCode, total }),
      token,
      },
    );

    const payload = isRecord(response)
      ? (isRecord(response.data) ? (response.data as UnknownRecord) : response)
      : {};
    return {
      valid: normalizeBoolean(payload.valid, false),
      discountAmount: Math.max(0, normalizeNumber(payload.discountAmount, 0)),
      message: normalizeString(payload.message, normalizeBoolean(payload.valid) ? 'Coupon applied' : 'Invalid coupon'),
    };
  } catch {
    return {
      valid: false,
      discountAmount: 0,
      message: 'Coupon validation failed',
    };
  }
}
