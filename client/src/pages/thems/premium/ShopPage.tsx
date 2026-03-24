import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import Skeleton from '@/components/common/Skeleton';
import ProductCard from '@/components/store/ProductCard';
import { Button } from '@/components/ui/button';
import { storefrontQueryKeys } from '@/features/storefront/api/queryKeys';
import { fetchProductCategories, fetchProducts } from '@/features/storefront/api/storefrontApi';
import type { ProductAvailability, ProductQueryInput, ProductQueryResult, ProductSort } from '@/features/storefront/types';
import { useSeo } from '@/hooks/use-seo';

const SORT_OPTIONS: Array<{ label: string; value: ProductSort }> = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Top Rated', value: 'rating_desc' },
  { label: 'Most Popular', value: 'popular' },
  { label: 'Best Seller', value: 'best_seller' },
  { label: 'Biggest Discount', value: 'discount_desc' },
];

const AVAILABILITY_OPTIONS: Array<{ label: string; value: ProductAvailability | '' }> = [
  { label: 'All', value: '' },
  { label: 'In Stock', value: 'in_stock' },
  { label: 'Out of Stock', value: 'out_of_stock' },
  { label: 'Preorder', value: 'preorder' },
];

function parsePositiveNumber(rawValue: string | null): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

export default function ShopPage() {
  useSeo({
    title: 'Shop',
    description: 'Browse products with filtering, sorting, and pagination.',
  });

  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ProductQueryInput>(() => {
    const availabilityValue = searchParams.get('availability');
    const availability: ProductAvailability | undefined =
      availabilityValue === 'in_stock' || availabilityValue === 'out_of_stock' || availabilityValue === 'preorder'
        ? availabilityValue
        : undefined;

    const sortValue = searchParams.get('sort');
    const normalizedSort: ProductSort = SORT_OPTIONS.some((option) => option.value === sortValue)
      ? (sortValue as ProductSort)
      : 'newest';

    return {
      page: Math.max(1, Number(searchParams.get('page') || 1)),
      limit: 20,
      category: searchParams.get('category') || undefined,
      minPrice: parsePositiveNumber(searchParams.get('minPrice')),
      maxPrice: parsePositiveNumber(searchParams.get('maxPrice')),
      rating: parsePositiveNumber(searchParams.get('rating')),
      availability,
      sort: normalizedSort,
      featured: searchParams.get('featured') === 'true',
      trending: searchParams.get('trending') === 'true',
      bestSeller: searchParams.get('bestSeller') === 'true',
    };
  }, [searchParams]);

  const categoriesQuery = useQuery({
    queryKey: ['storefront', 'categories'],
    queryFn: fetchProductCategories,
    staleTime: 5 * 60 * 1000,
  });

  const productsQuery = useQuery<ProductQueryResult>({
    queryKey: storefrontQueryKeys.products(filters),
    queryFn: () => fetchProducts(filters),
    placeholderData: (previousData) => previousData,
  });

  const updateFilter = (updates: Record<string, string | undefined>) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });

    if (!('page' in updates)) {
      nextParams.set('page', '1');
    }

    setSearchParams(nextParams);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const totalPages = productsQuery.data?.meta.totalPages ?? 1;
  const currentPage = productsQuery.data?.meta.page ?? filters.page ?? 1;

  return (
    <div className="premium-route premium-route-shop space-y-7">
      <section className="storefront-panel premium-hero relative overflow-hidden p-6 sm:p-7">
        <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 left-10 h-44 w-44 rounded-full bg-amber-300/25 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <span className="storefront-kicker">Maison Collection Rooms</span>
            <h1 className="storefront-heading text-3xl font-semibold text-slate-900 sm:text-4xl">Luxury Product Gallery</h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Discover merchant-curated items with filtering by category, price, rating, and stock availability.
            </p>
          </div>

          <div className="storefront-chip">
            <Filter className="h-3.5 w-3.5" />
            {productsQuery.data?.meta.total || 0} products
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="storefront-panel h-fit p-4 lg:sticky lg:top-24">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="storefront-heading text-lg font-semibold text-slate-900">Filters</h2>
            <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-900" onClick={clearFilters}>
              Reset
            </button>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-600">Category</span>
              <select
                value={filters.category || ''}
                onChange={(event) => updateFilter({ category: event.target.value || undefined })}
                className="storefront-select"
              >
                <option value="">All categories</option>
                {(categoriesQuery.data || []).map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Min price</span>
                <input
                  type="number"
                  min={0}
                  value={filters.minPrice ?? ''}
                  onChange={(event) => updateFilter({ minPrice: event.target.value || undefined })}
                  className="storefront-input"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Max price</span>
                <input
                  type="number"
                  min={0}
                  value={filters.maxPrice ?? ''}
                  onChange={(event) => updateFilter({ maxPrice: event.target.value || undefined })}
                  className="storefront-input"
                />
              </label>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-600">Rating</span>
              <select
                value={filters.rating ? String(filters.rating) : ''}
                onChange={(event) => updateFilter({ rating: event.target.value || undefined })}
                className="storefront-select"
              >
                <option value="">All ratings</option>
                <option value="4">4 stars & above</option>
                <option value="3">3 stars & above</option>
                <option value="2">2 stars & above</option>
              </select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-600">Availability</span>
              <select
                value={filters.availability || ''}
                onChange={(event) => updateFilter({ availability: event.target.value || undefined })}
                className="storefront-select"
              >
                {AVAILABILITY_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="storefront-panel flex flex-wrap items-center justify-between gap-3 p-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              Sort by
              <select
                value={filters.sort}
                onChange={(event) => updateFilter({ sort: event.target.value })}
                className="storefront-select min-w-[12rem] w-auto"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-1.5">
              {filters.featured ? <span className="storefront-chip">Featured</span> : null}
              {filters.trending ? <span className="storefront-chip">Trending</span> : null}
              {filters.bestSeller ? <span className="storefront-chip">Best Seller</span> : null}
              <span className="storefront-chip">
                Page {currentPage} of {totalPages}
              </span>
            </div>
          </div>

          {productsQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={String(index)} className="h-80" />
              ))}
            </div>
          ) : null}

          {productsQuery.isError ? (
            <div className="rounded-xl border border-red-200/80 bg-red-50/90 p-4 text-sm text-red-700">
              Failed to load products. Please refresh.
            </div>
          ) : null}

          {!productsQuery.isLoading && !productsQuery.isError ? (
            <>
              {(productsQuery.data?.items.length || 0) === 0 ? (
                <div className="storefront-panel p-10 text-center text-sm text-slate-500">
                  No products found with the selected filters.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {productsQuery.data?.items.map((product) => (
                    <ProductCard key={product.id} product={product} showFeaturedBadge />
                  ))}
                </div>
              )}

              <div className="storefront-panel flex items-center justify-between gap-2 p-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => updateFilter({ page: String(currentPage - 1) })}
                >
                  Previous
                </Button>
                <p className="storefront-chip">
                  {currentPage} / {totalPages}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => updateFilter({ page: String(currentPage + 1) })}
                >
                  Next
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
