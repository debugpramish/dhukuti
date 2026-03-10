import type { ProductQueryInput } from '@/features/storefront/types';

export const storefrontQueryKeys = {
  featuredProducts: ['storefront', 'products', 'featured'] as const,
  trendingProducts: ['storefront', 'products', 'trending'] as const,
  bestSellerProducts: ['storefront', 'products', 'best-seller'] as const,
  products: (params: ProductQueryInput) => ['storefront', 'products', params] as const,
  productDetail: (slug: string) => ['storefront', 'product', slug] as const,
  relatedProducts: (slug: string) => ['storefront', 'product', slug, 'related'] as const,
  searchProducts: (query: string) => ['storefront', 'search', query] as const,
  searchSuggestions: (query: string) => ['storefront', 'search', 'suggestions', query] as const,
  customerOrders: ['storefront', 'customer-orders'] as const,
  customerOrder: (orderId: string) => ['storefront', 'customer-order', orderId] as const,
  page: (slug: string) => ['storefront', 'page', slug] as const,
};
