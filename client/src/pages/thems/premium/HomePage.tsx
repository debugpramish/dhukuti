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

import './HomePage.css';

function ProductGridSection(props: {
  title: string;
  ctaHref: string;
  ctaLabel: string;
  subtitle: string;
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
        <div>
          <h2 className="mp-h">{props.title}</h2>
          <p className="mp-head-sub">{props.subtitle}</p>
        </div>
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
                <div className="mp-price-row">
                  <div className="mp-price">{formatCurrency(product.price)}</div>
                  <span className="mp-badge">Maison</span>
                </div>
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
  const spotlight = featured[0] || trending[0] || bestSellers[0];

  return (
    <div className="maison-shell space-y-6 pb-10">
      <div className="mp-backdrop" aria-hidden />
      <div className="mp-noise" aria-hidden />

      <section className="mp-hero mp-fade">
        <div className="mp-hero-grid">
          <div>
            <div className="mp-kicker">Premium Theme Live Preview</div>
            <h1 className="mp-title">
              {storeName}
              <br />
              Elevated Digital Atelier
            </h1>
            <p className="mp-sub">
              A cinematic storefront language designed for premium conversion: rich composition, confident typography,
              and live catalogue intelligence powered directly from your real products.
            </p>
            <div className="mp-cta-row">
              <Link to="/shop" className="mp-btn mp-btn-main">Explore Collection</Link>
              <Link to="/search" className="mp-btn mp-btn-alt">Search Products</Link>
            </div>
            <div className="mp-quote">
              <span className="mp-quote-line" />
              <p>
                Crafted for merchants who want their storefront to feel like a luxury publication, not a commodity grid.
              </p>
            </div>
          </div>

          <aside className="mp-stat-panel mp-fade mp-fade-delay-1">
            {spotlight ? (
              <Link to={`/product/${spotlight.slug}`} className="mp-spotlight">
                <div className="mp-spotlight-img">
                  <img src={spotlight.thumbnail} alt={spotlight.title} loading="lazy" />
                </div>
                <div className="mp-spotlight-body">
                  <span className="mp-spotlight-k">Spotlight</span>
                  <h3>{spotlight.title}</h3>
                  <p>{formatCurrency(spotlight.price)}</p>
                </div>
              </Link>
            ) : null}
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

      <section className="mp-marquee-wrap mp-fade mp-fade-delay-1" aria-label="Brand strip">
        <div className="mp-marquee-track">
          <span>Maison Curated</span>
          <i />
          <span>Editorial Commerce</span>
          <i />
          <span>High Conversion UX</span>
          <i />
          <span>Luxury Typography</span>
          <i />
          <span>Premium Motion</span>
          <i />
          <span>Maison Curated</span>
          <i />
          <span>Editorial Commerce</span>
          <i />
          <span>High Conversion UX</span>
        </div>
      </section>

      <section className="mp-section mp-fade mp-fade-delay-1">
        <div className="mp-head">
          <div>
            <h2 className="mp-h">Featured Categories</h2>
            <p className="mp-head-sub">Collection architecture built from your live catalog taxonomy.</p>
          </div>
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
                <div className="mp-price-row">
                  <div className="mp-price">{category.productCount || 0} products</div>
                  <span className="mp-category-arrow">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ProductGridSection
        title="Featured Edit"
        ctaHref="/shop?featured=true"
        ctaLabel="View Featured"
        subtitle="Signature products prioritized for conversion and storytelling."
        products={featured}
      />

      <ProductGridSection
        title="Trending Right Now"
        ctaHref="/shop?trending=true"
        ctaLabel="See Trending"
        subtitle="Live momentum from what customers are viewing and purchasing most."
        products={trending}
      />

      <ProductGridSection
        title="Best Sellers"
        ctaHref="/shop?bestSeller=true"
        ctaLabel="Shop Best Sellers"
        subtitle="Top-performing SKUs curated for trust, social proof, and fast decisions."
        products={bestSellers}
      />

      <section className="mp-editorial-band mp-fade mp-fade-delay-3">
        <div>
          <span className="mp-kicker">Premium Narrative Block</span>
          <h2 className="mp-h">Make Every Visit Feel Like A Private Release</h2>
          <p className="mp-head-sub">
            Your premium template now combines high-fashion editorial rhythm with commerce primitives: shoppable cards,
            clear hierarchy, and adaptive layouts for desktop and mobile.
          </p>
        </div>
        <Link to="/contact" className="mp-btn mp-btn-main">Work With Concierge</Link>
      </section>
    </div>
  );
}
