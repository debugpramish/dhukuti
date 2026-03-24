import { FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import ProductCard from '@/components/store/ProductCard';
import { storefrontQueryKeys } from '@/features/storefront/api/queryKeys';
import { fetchSearchSuggestions, searchProducts } from '@/features/storefront/api/storefrontApi';
import { useDebounce } from '@/hooks/use-debounce';
import { useSeo } from '@/hooks/use-seo';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 250);

  useSeo({
    title: query ? `Search: ${query}` : 'Search',
    description: 'Search products with live suggestions.',
  });

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const suggestionsQuery = useQuery({
    queryKey: storefrontQueryKeys.searchSuggestions(debouncedQuery),
    queryFn: () => fetchSearchSuggestions(debouncedQuery, 8),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  const resultsQuery = useQuery({
    queryKey: storefrontQueryKeys.searchProducts(initialQuery),
    queryFn: () => searchProducts(initialQuery, 30),
    enabled: initialQuery.trim().length >= 1,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = query.trim();

    setSearchParams(nextQuery ? { q: nextQuery } : {});
  };

  return (
    <div className="premium-route premium-route-search space-y-7">
      <section className="storefront-panel premium-hero relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="relative space-y-2">
          <span className="storefront-kicker">Curated Discovery</span>
          <h1 className="storefront-heading text-3xl font-semibold text-slate-900">Find Signature Pieces</h1>
          <p className="text-sm text-slate-600">Live suggestions and direct results from real merchant inventory.</p>
        </div>
      </section>

      <div className="storefront-panel p-4">
        <form onSubmit={handleSubmit} className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            className="storefront-input h-11 rounded-xl pl-9 pr-3"
          />
        </form>

        {debouncedQuery.trim().length >= 2 ? (
          <div className="mt-3 rounded-xl border border-slate-200/80 bg-white/75 p-2.5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Live Suggestions</p>
            {suggestionsQuery.isLoading ? <p className="text-sm text-slate-500">Loading suggestions...</p> : null}
            {suggestionsQuery.isError ? <p className="text-sm text-red-600">Unable to load suggestions.</p> : null}
            {(suggestionsQuery.data || []).length === 0 && !suggestionsQuery.isLoading ? (
              <p className="text-sm text-slate-500">No suggestions found.</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(suggestionsQuery.data || []).map((suggestion) => (
                <Link
                  key={suggestion.id}
                  to={`/product/${suggestion.slug}`}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  <img
                    src={suggestion.thumbnail}
                    alt={suggestion.title}
                    loading="lazy"
                    className="h-10 w-10 rounded object-cover"
                  />
                  <p className="line-clamp-2 text-sm text-slate-700">{suggestion.title}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {initialQuery.trim().length === 0 ? (
        <div className="storefront-panel p-8 text-center text-sm text-slate-500">
          Enter a keyword to start searching.
        </div>
      ) : null}

      {initialQuery.trim().length > 0 ? (
        <section className="space-y-3">
          <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Search Results for "{initialQuery}"</h2>

          {resultsQuery.isLoading ? <p className="storefront-chip">Searching products...</p> : null}
          {resultsQuery.isError ? <p className="text-sm text-red-600">Search request failed.</p> : null}

          {(resultsQuery.data || []).length === 0 && !resultsQuery.isLoading ? (
            <p className="storefront-panel p-4 text-sm text-slate-500">No results found.</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(resultsQuery.data || []).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
