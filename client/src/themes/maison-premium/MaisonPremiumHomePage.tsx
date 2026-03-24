import { useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { storefrontQueryKeys } from '@/features/storefront/api/queryKeys';
import {
  fetchBestSellerProducts,
  fetchFeaturedProducts,
  fetchProductCategories,
  fetchProducts,
  fetchStorefrontStore,
  fetchTrendingProducts,
} from '@/features/storefront/api/storefrontApi';
import { formatCurrency } from '@/features/storefront/utils';
import { useSeo } from '@/hooks/use-seo';

import './MaisonPremiumHomePage.css';

function ProductGridSection(props: {
  title: string;
  ctaHref: string;
  ctaLabel: string;
  products: Array<{
    id: string;
    slug: string;
    title: string;
    category: string;
    thumbnail: string;
    price: number;
  }>;
}) {
  return (
    <section className="mp-section mp-fade mp-fade-delay-2">
      <div className="mp-head">
        <h2 className="mp-h">{props.title}</h2>
        <Link to={props.ctaHref} className="mp-link">{props.ctaLabel}</Link>
      </div>
      {props.products.length === 0 ? (
        <div className="mp-empty">No products yet. Add products in dashboard to populate this premium layout.</div>
      ) : (
        <div className="mp-grid">
          {props.products.map((product) => (
            <Link key={product.id} to={`/product/${product.slug}`} className="mp-product">
              <div className="mp-product-figure">
                <img src={product.thumbnail} alt={product.title} loading="lazy" />
              </div>
              <div className="mp-product-body">
                <div className="mp-product-category">{product.category}</div>
                <h3 className="mp-product-title">{product.title}</h3>
                <div className="mp-price">{formatCurrency(product.price)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default function MaisonPremiumHomePage() {
  useSeo({
    title: 'Maison Premium',
    description: 'An editorial-grade premium storefront powered by live catalog data.',
  });

  const [storeQuery, featuredQuery, categoriesQuery, trendingQuery, bestSellerQuery, allProductsQuery] = useQueries({
    queries: [
      {
        queryKey: ['storefront', 'store-info'] as const,
        queryFn: fetchStorefrontStore,
      },
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
      {
        queryKey: storefrontQueryKeys.products({ page: 1, limit: 12, sort: 'popular' }),
        queryFn: () => fetchProducts({ page: 1, limit: 12, sort: 'popular' }),
      },
    ],
  });

  const allProducts = allProductsQuery.data?.items || [];

  function pickProducts(primary: typeof allProducts, fallbackStartIndex: number) {
    if (primary.length > 0) {
      return primary.slice(0, 4);
    }

    return allProducts.slice(fallbackStartIndex, fallbackStartIndex + 4);
  }

  const storeName = storeQuery.data?.name || 'Dhukuti';
  const featured = pickProducts(featuredQuery.data || [], 0);
  const trending = pickProducts(trendingQuery.data || [], 4);
  const bestSellers = pickProducts(bestSellerQuery.data || [], 8);
  const categories = (categoriesQuery.data || []).slice(0, 4);

  return (
    <div className="maison-shell space-y-6 pb-10">
      <div className="mp-backdrop" aria-hidden />

      <section className="mp-hero mp-fade">
        <div className="mp-hero-grid">
          <div>
            <div className="mp-kicker">Premium Theme Live Preview</div>
            <h1 className="mp-title">
              {storeName}
              <br />
              Curated Luxury Commerce
            </h1>
            <p className="mp-sub">
              This storefront layout is driven by your live products and categories. Merchants can preview this design before
              activation, and publish it once premium payment is completed.
            </p>
            <div className="mp-cta-row">
              <Link to="/shop" className="mp-btn mp-btn-main">Explore Collection</Link>
              <Link to="/search" className="mp-btn mp-btn-alt">Search Products</Link>
            </div>
          </div>

          <aside className="mp-stat-panel mp-fade mp-fade-delay-1">
            <div className="mp-stat-grid">
              <div>
                <div className="mp-stat-value">{String(categories.length).padStart(2, '0')}</div>
                <div className="mp-stat-label">Curated Categories</div>
              </div>
              <div>
                <div className="mp-stat-value">{String(featured.length).padStart(2, '0')}</div>
                <div className="mp-stat-label">Featured Products</div>
              </div>
              <div>
                <div className="mp-stat-value">{String(trending.length).padStart(2, '0')}</div>
                <div className="mp-stat-label">Trending Products</div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mp-section mp-fade mp-fade-delay-1">
        <div className="mp-head">
          <h2 className="mp-h">Featured Categories</h2>
          <Link to="/shop" className="mp-link">Browse Catalog</Link>
        </div>
        {categories.length === 0 ? (
          <div className="mp-empty">No categories found yet. Create products with categories to unlock this section.</div>
        ) : (
          <div className="mp-category-grid">
            {categories.map((category) => (
              <Link
                key={category.key}
                to={`/shop?category=${encodeURIComponent(category.key)}`}
                className="mp-category-card"
              >
                <div className="mp-product-category">Category</div>
                <h3 className="mp-product-title">{category.label}</h3>
                <div className="mp-price">{category.productCount || 0} products</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ProductGridSection
        title="Featured Edit"
        ctaHref="/shop?featured=true"
        ctaLabel="View Featured"
        products={featured}
      />

      <ProductGridSection
        title="Trending Right Now"
        ctaHref="/shop?trending=true"
        ctaLabel="See Trending"
        products={trending}
      />

      <ProductGridSection
        title="Best Sellers"
        ctaHref="/shop?bestSeller=true"
        ctaLabel="Shop Best Sellers"
        products={bestSellers}
      />
    </div>
  );
}
