import { FormEvent, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import Skeleton from '@/components/common/Skeleton';
import ProductCard from '@/components/store/ProductCard';
import { Button } from '@/components/ui/button';
import { storefrontQueryKeys } from '@/features/storefront/api/queryKeys';
import {
  fetchBestSellerProducts,
  fetchFeaturedProducts,
  fetchProductCategories,
  fetchTrendingProducts,
} from '@/features/storefront/api/storefrontApi';
import { useSeo } from '@/hooks/use-seo';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';

export default function HomePage() {
  useSeo({
    title: 'Home',
    description: 'Discover featured categories, trending products, and top sellers.',
  });

  const pushToast = useStorefrontUiStore((state) => state.pushToast);
  const [newsletterEmail, setNewsletterEmail] = useState('');

  const [featuredQuery, categoriesQuery, trendingQuery, bestSellerQuery] = useQueries({
    queries: [
      {
        queryKey: storefrontQueryKeys.featuredProducts,
        queryFn: () => fetchFeaturedProducts(8),
      },
      {
        queryKey: ['storefront', 'categories'] as const,
        queryFn: fetchProductCategories,
      },
      {
        queryKey: storefrontQueryKeys.trendingProducts,
        queryFn: () => fetchTrendingProducts(8),
      },
      {
        queryKey: storefrontQueryKeys.bestSellerProducts,
        queryFn: () => fetchBestSellerProducts(8),
      },
    ],
  });

  const handleNewsletterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newsletterEmail.trim()) {
      return;
    }

    pushToast({
      variant: 'success',
      title: 'Newsletter subscription confirmed',
      description: `${newsletterEmail} has been added to updates.`,
    });
    setNewsletterEmail('');
  };

  return (
    <div className="space-y-12 pb-12">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-900 p-8 text-white shadow-[0_36px_70px_-40px_rgba(2,6,23,1)] sm:p-12">
        <div className="relative z-10 max-w-2xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 px-3 py-1 text-xs uppercase tracking-wide text-white/85">
            <Sparkles className="h-3.5 w-3.5" />
            New season collection
          </div>
          <h1 className="storefront-heading text-4xl font-semibold leading-tight sm:text-6xl">
            Everything your customers need in one storefront.
          </h1>
          <p className="text-sm text-white/85 sm:text-base">
            Shop top-rated products, unlock exclusive deals, and checkout in minutes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
            >
              Shop now
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/search"
              className="inline-flex h-10 items-center rounded-md border border-white/60 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Search products
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-20 top-12 hidden h-[15rem] w-[15rem] rounded-3xl border border-white/25 bg-white/10 p-4 backdrop-blur md:block">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-white/75">This Week</p>
            <p className="mt-2 text-3xl font-bold">+38%</p>
            <p className="mt-1 text-xs text-white/75">Order growth from featured drops</p>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Featured Categories</h2>
          <Link to="/shop" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            View all products
          </Link>
        </div>

        {categoriesQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={String(index)} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(categoriesQuery.data || []).slice(0, 5).map((category) => (
              <Link
                key={category.key}
                to={`/shop?category=${encodeURIComponent(category.key)}`}
                className="storefront-surface group relative overflow-hidden rounded-2xl p-4 transition hover:-translate-y-1"
              >
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-cyan-100/50 to-transparent" />
                <p className="font-medium text-slate-900">{category.label}</p>
                <p className="text-xs text-slate-500">{category.productCount || 0} products</p>
                <div className="mt-3 text-xs font-semibold text-cyan-800">Browse category</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Featured Products</h2>
          <Link to="/shop?featured=true" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            See all
          </Link>
        </div>

        {featuredQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={String(index)} className="h-80" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(featuredQuery.data || []).slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} showFeaturedBadge />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Trending Products</h2>
          <Link to="/shop?trending=true&sort=popular" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            See all
          </Link>
        </div>

        {trendingQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={String(index)} className="h-80" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(trendingQuery.data || []).slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Best Sellers</h2>
          <Link to="/shop?bestSeller=true&sort=best_seller" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            See all
          </Link>
        </div>

        {bestSellerQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={String(index)} className="h-80" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(bestSellerQuery.data || []).slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="storefront-surface rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Promo Banner</p>
            <h3 className="storefront-heading mt-1 text-2xl font-semibold text-slate-900">Free shipping on orders over RS1500</h3>
            <p className="mt-1 text-sm text-slate-600">Limited-time offer for this week only.</p>
          </div>
          <Link
            to="/shop"
            className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Shop deals
          </Link>
        </div>
      </section>

      <section className="storefront-surface rounded-3xl p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h3 className="storefront-heading text-2xl font-semibold text-slate-900">Join our newsletter</h3>
            <p className="mt-1 text-sm text-slate-600">Get product drops, best seller updates, and seasonal offers.</p>
          </div>
          <form onSubmit={handleNewsletterSubmit} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <input
              type="email"
              value={newsletterEmail}
              onChange={(event) => setNewsletterEmail(event.target.value)}
              required
              placeholder="you@example.com"
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 sm:w-64"
            />
            <Button type="submit">Subscribe</Button>
          </form>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/40 bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-[0_30px_70px_-40px_rgba(15,23,42,1)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="storefront-heading text-2xl font-semibold">Need help before placing an order?</h3>
            <p className="mt-1 text-sm text-slate-200">
              Reach out for sizing help, delivery questions, or bulk purchase support.
            </p>
          </div>
          <Link
            to="/contact"
            className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
          >
            Contact Store
          </Link>
        </div>
      </section>

      {featuredQuery.isError || trendingQuery.isError || bestSellerQuery.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Some sections failed to load. Refresh the page to retry.
        </div>
      ) : null}
    </div>
  );
}
