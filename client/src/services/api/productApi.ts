import { httpRequest, unwrapData } from './httpClient';
import { API_BASE_URL } from './httpClient';
import {
  DISCOUNT_TYPE_VALUES,
  PRODUCT_PAYMENT_POLICY_VALUES,
  PRODUCT_STATUS_VALUES,
  type ProductCreateInput,
  type Product,
  type DiscountType,
  type ProductPaymentPolicy,
  type ProductStatus,
  type ProductUpdateInput,
  type ProductVariant,
} from './types';
import { normalizeProductImageUrl } from '@/lib/image';

type ProductsPayload = Product[] | { products: Product[] };
type ProductPayload = Product | { product: Product };
type ProductsResponse = ProductsPayload | { data: ProductsPayload };
type ProductResponse = ProductPayload | { data: ProductPayload };

function isProductStatus(value: string): value is ProductStatus {
  return PRODUCT_STATUS_VALUES.some((status) => status === value);
}

function normalizeStatus(status: string): ProductStatus {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  return isProductStatus(normalized) ? normalized : 'draft';
}

function isDiscountType(value: string): value is DiscountType {
  return DISCOUNT_TYPE_VALUES.some((discountType) => discountType === value);
}

function normalizeDiscountType(discountType: string): DiscountType {
  const normalized = typeof discountType === 'string' ? discountType.toLowerCase() : '';
  return isDiscountType(normalized) ? normalized : 'none';
}

function isProductPaymentPolicy(value: string): value is ProductPaymentPolicy {
  return PRODUCT_PAYMENT_POLICY_VALUES.some((policy) => policy === value);
}

function normalizePaymentPolicy(paymentPolicy: string): ProductPaymentPolicy {
  const normalized = typeof paymentPolicy === 'string' ? paymentPolicy.trim().toUpperCase() : '';
  if (normalized === 'COD_ALLOWED') {
    return 'POSTPAID';
  }

  return isProductPaymentPolicy(normalized) ? normalized : 'POSTPAID';
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

function normalizeProduct(product: Product): Product {
  const normalizedPrice = Number(product.price ?? 0);
  const normalizedDiscountType = normalizeDiscountType(product.discountType);
  const normalizedDiscountValue = Number(product.discountValue ?? 0);
  const normalizedDiscountedPrice = Number(
    product.discountedPrice ?? calculateDiscountedPrice(normalizedPrice, normalizedDiscountType, normalizedDiscountValue),
  );
  const normalizedDiscountAmount = Number(
    product.discountAmount ?? Math.max(0, normalizedPrice - normalizedDiscountedPrice),
  );

  return {
    ...product,
    category: String(product.category ?? '').trim() || 'Uncategorized',
    price: normalizedPrice,
    discountType: normalizedDiscountType,
    discountValue: normalizedDiscountValue,
    discountedPrice: normalizedDiscountedPrice,
    discountAmount: normalizedDiscountAmount,
    hasDiscount: Boolean(product.hasDiscount ?? normalizedDiscountAmount > 0),
    paymentPolicy: normalizePaymentPolicy(product.paymentPolicy),
    status: normalizeStatus(product.status),
    imageUrl: normalizeProductImageUrl(product.imageUrl, product.title, API_BASE_URL),
    isFeatured: Boolean(product.isFeatured),
    isTrending: Boolean(product.isTrending),
    isBestSeller: Boolean(product.isBestSeller),
    variants: normalizeVariants(product.variants),
  };
}

function normalizeProducts(payload: ProductsPayload): Product[] {
  const products = Array.isArray(payload) ? payload : payload.products;
  const productList = Array.isArray(products) ? products : [];
  return productList.map(normalizeProduct);
}

function normalizeSingleProduct(payload: ProductPayload): Product {
  const product = 'product' in payload ? payload.product : payload;
  return normalizeProduct(product);
}

export async function getProducts(): Promise<Product[]> {
  const response = await httpRequest<ProductsResponse>('/api/products', {
    method: 'GET',
  });

  return normalizeProducts(unwrapData<ProductsPayload>(response));
}

export async function createProduct(payload: ProductCreateInput): Promise<Product> {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('category', payload.category?.trim() || 'Uncategorized');
  formData.append('price', String(payload.price));
  formData.append('discountType', payload.discountType);
  formData.append('discountValue', String(payload.discountValue));
  formData.append('status', payload.status);
  formData.append('paymentPolicy', payload.paymentPolicy);
  formData.append('isFeatured', String(Boolean(payload.isFeatured)));
  formData.append('isTrending', String(Boolean(payload.isTrending)));
  formData.append('isBestSeller', String(Boolean(payload.isBestSeller)));
  if (typeof payload.stock === 'number' && Number.isFinite(payload.stock)) {
    formData.append('stock', String(payload.stock));
  }
  if (typeof payload.lowStockThreshold === 'number' && Number.isFinite(payload.lowStockThreshold)) {
    formData.append('lowStockThreshold', String(payload.lowStockThreshold));
  }

  if (payload.imageFile) {
    formData.append('image', payload.imageFile);
  }

  const response = await httpRequest<ProductResponse>('/api/products', {
    method: 'POST',
    body: formData,
  });

  return normalizeSingleProduct(unwrapData<ProductPayload>(response));
}

export async function updateProduct(productId: string, payload: ProductUpdateInput): Promise<Product> {
  const formData = new FormData();
  formData.append('price', String(payload.price));
  formData.append('discountType', payload.discountType);
  formData.append('discountValue', String(payload.discountValue));
  if (payload.paymentPolicy) {
    formData.append('paymentPolicy', payload.paymentPolicy);
  }

  if (payload.imageFile) {
    formData.append('image', payload.imageFile);
  }

  const response = await httpRequest<ProductResponse>(`/api/products/${productId}`, {
    method: 'PUT',
    body: formData,
  });

  return normalizeSingleProduct(unwrapData<ProductPayload>(response));
}

export async function deleteProduct(productId: string): Promise<void> {
  await httpRequest<{ message?: string }>(`/api/products/${productId}`, {
    method: 'DELETE',
  });
}

export async function updateProductFeatured(productId: string, isFeatured: boolean): Promise<Product> {
  const response = await httpRequest<ProductResponse>(`/api/products/${productId}/featured`, {
    method: 'PATCH',
    body: { isFeatured },
  });

  return normalizeSingleProduct(unwrapData<ProductPayload>(response));
}

export async function updateProductFlags(
  productId: string,
  payload: Partial<Pick<Product, 'isFeatured' | 'isTrending' | 'isBestSeller'>>,
): Promise<Product> {
  const response = await httpRequest<ProductResponse>(`/api/products/${productId}/flags`, {
    method: 'PATCH',
    body: payload,
  });

  return normalizeSingleProduct(unwrapData<ProductPayload>(response));
}
