import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';

import ProductCard from '@/components/store/ProductCard';
import { getOrCreateStoreSessionId, getStoredTrafficSource } from '@/lib/store-analytics';
import { getPublicStoreProducts, trackPublicStoreEvents } from '@/services/api/publicStoreApi';
import type { PublicStoreLayoutContext } from '@/layouts/PublicStoreLayout';

export default function PublicStoreCatalogPage() {
  const { slug } = useOutletContext<PublicStoreLayoutContext>();
  const trackedProductsSignatureRef = useRef('');
  const analyticsSessionId = useMemo(() => getOrCreateStoreSessionId(slug), [slug]);
  const trafficSource = useMemo(() => getStoredTrafficSource(), []);

  const { data: products, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['public-store-products', slug, 'catalog'],
    queryFn: () => getPublicStoreProducts(slug),
    retry: 1,
  });

  useEffect(() => {
    void trackPublicStoreEvents(slug, {
      sessionId: analyticsSessionId,
      trafficSource,
      events: [{ eventType: 'store_visit' }],
    }).catch(() => undefined);
  }, [analyticsSessionId, slug, trafficSource]);

  useEffect(() => {
    if (!products || products.length === 0) {
      trackedProductsSignatureRef.current = '';
      return;
    }

    const signature = products.map((product) => product.id).sort().join(',');
    if (!signature || trackedProductsSignatureRef.current === signature) {
      return;
    }
    trackedProductsSignatureRef.current = signature;

    void trackPublicStoreEvents(slug, {
      sessionId: analyticsSessionId,
      trafficSource,
      events: products.map((product) => ({
        eventType: 'product_view',
        productId: product.id,
        sku: product.variants[0]?.sku,
      })),
    }).catch(() => undefined);
  }, [analyticsSessionId, products, slug, trafficSource]);

  return (
    <div className="overflow-hidden rounded-sm border border-slate-300 bg-[#f2f2f2]">
      <section className="border-b border-slate-300 bg-white px-5 py-8 sm:px-10">
        <h1 className="text-4xl font-semibold text-slate-800 sm:text-5xl">Catalog</h1>
        <p className="mt-2 text-sm text-slate-600">Browse all products from this merchant catalog.</p>
        {!isLoading && !isError && products ? (
          <p className="mt-2 text-sm font-medium text-slate-700">
            {products.length} {products.length === 1 ? 'item' : 'items'}
          </p>
        ) : null}
      </section>

      <section className="space-y-5 px-5 py-8 sm:px-10 sm:py-10">
        {isLoading ? <p className="text-sm text-slate-600">Loading products...</p> : null}

        {isError ? (
          <div className="space-y-2 rounded-lg border border-red-200 bg-white p-4">
            <p className="text-sm text-red-600">{error instanceof Error ? error.message : 'Unable to load products'}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!isLoading && !isError && products && products.length === 0 ? (
          <p className="rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-600">
            No products available at the moment.
          </p>
        ) : null}

        {!isLoading && !isError && products && products.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} showFeaturedBadge />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
