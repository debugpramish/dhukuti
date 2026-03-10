import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import ProductCard from '@/components/store/ProductCard';
import { buildProductPlaceholderImage } from '@/lib/image';
import { getOrCreateStoreSessionId, getStoredTrafficSource } from '@/lib/store-analytics';
import { getPublicStoreProducts, trackPublicStoreEvents } from '@/services/api/publicStoreApi';
import type { PublicStoreLayoutContext } from '@/layouts/PublicStoreLayout';

export default function PublicStoreHomePage() {
  const { slug, store } = useOutletContext<PublicStoreLayoutContext>();

  const { data: products, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['public-store-products', slug, 'home'],
    queryFn: () => getPublicStoreProducts(slug, { limit: 24 }),
    retry: 1,
  });

  const featuredProducts = useMemo(() => (products || []).filter((product) => product.isFeatured), [products]);
  const heroProduct = featuredProducts[0] || products?.[0] || null;
  const showcaseProducts = featuredProducts.length > 0 ? featuredProducts : (products || []).slice(0, 8);
  const trackedProductsSignatureRef = useRef('');
  const analyticsSessionId = useMemo(() => getOrCreateStoreSessionId(slug), [slug]);
  const trafficSource = useMemo(() => getStoredTrafficSource(), []);

  useEffect(() => {
    void trackPublicStoreEvents(slug, {
      sessionId: analyticsSessionId,
      trafficSource,
      events: [{ eventType: 'store_visit' }],
    }).catch(() => undefined);
  }, [analyticsSessionId, slug, trafficSource]);

  useEffect(() => {
    if (showcaseProducts.length === 0) {
      trackedProductsSignatureRef.current = '';
      return;
    }

    const signature = showcaseProducts.map((product) => product.id).sort().join(',');
    if (!signature || trackedProductsSignatureRef.current === signature) {
      return;
    }
    trackedProductsSignatureRef.current = signature;

    void trackPublicStoreEvents(slug, {
      sessionId: analyticsSessionId,
      trafficSource,
      events: showcaseProducts.map((product) => ({
        eventType: 'product_view',
        productId: product.id,
        sku: product.variants[0]?.sku,
      })),
    }).catch(() => undefined);
  }, [analyticsSessionId, showcaseProducts, slug, trafficSource]);

  return (
    <div className="overflow-hidden rounded-sm border border-slate-300 bg-[#f2f2f2]">
      <section className="relative min-h-[320px] overflow-hidden sm:min-h-[420px]">
        {heroProduct ? (
          <img
            src={heroProduct.imageUrl}
            alt={heroProduct.title}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => {
              const image = event.currentTarget;
              image.onerror = null;
              image.src = buildProductPlaceholderImage(heroProduct.title);
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-500" />
        )}

        <div className="absolute inset-0 bg-slate-900/35" />

        <div className="relative flex min-h-[320px] items-center justify-center px-6 text-center sm:min-h-[420px]">
          <div className="max-w-2xl space-y-5">
            <h1 className="text-4xl font-semibold text-white sm:text-6xl">Browse our latest products</h1>
            <p className="mx-auto max-w-xl text-sm text-white/90 sm:text-base">{store.description}</p>
            <div>
              <Link
                to={`/store/${slug}/catalog`}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/70 px-6 text-lg font-medium text-white transition-colors hover:bg-white/15"
              >
                Shop all
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5 px-5 py-8 sm:px-10 sm:py-10">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-4xl font-semibold text-slate-800 sm:text-5xl">Products</h2>
            {featuredProducts.length === 0 ? (
              <p className="text-sm text-slate-600">
                No featured products selected yet. Showing latest catalog items.
              </p>
            ) : (
              <p className="text-sm text-slate-600">Featured selections from your product catalog.</p>
            )}
          </div>

          <Link
            to={`/store/${slug}/catalog`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            View catalog
          </Link>
        </div>

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

        {!isLoading && !isError && showcaseProducts.length === 0 ? (
          <p className="rounded-lg border border-slate-300 bg-white p-4 text-sm text-slate-600">
            No products available yet in this store.
          </p>
        ) : null}

        {!isLoading && !isError && showcaseProducts.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {showcaseProducts.map((product) => (
              <ProductCard key={product.id} product={product} showFeaturedBadge={featuredProducts.length > 0} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
