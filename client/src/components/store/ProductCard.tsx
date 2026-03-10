import { Heart, ShoppingCart, Star, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { buildProductPlaceholderImage } from '@/lib/image';
import { cn } from '@/lib/utils';
import type { StorefrontProduct } from '@/features/storefront/types';
import type { Product as LegacyProduct } from '@/services/api/types';
import { useStorefrontCartStore } from '@/stores/storefront-cart-store';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';
import { useStorefrontWishlistStore } from '@/stores/storefront-wishlist-store';

type ProductCardProps = {
  product: StorefrontProduct | LegacyProduct;
  showFeaturedBadge?: boolean;
  className?: string;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function toCardProduct(product: StorefrontProduct | LegacyProduct): StorefrontProduct {
  if ('slug' in product && 'thumbnail' in product && 'availability' in product) {
    return product;
  }

  const compareAtPrice = product.price > product.discountedPrice ? product.price : undefined;
  const price = product.discountedPrice > 0 ? product.discountedPrice : product.price;

  return {
    id: product.id,
    slug: product.id,
    title: product.title,
    description: '',
    shortDescription: undefined,
    category: product.category || 'Uncategorized',
    price,
    compareAtPrice,
    discountPercent:
      compareAtPrice && compareAtPrice > price
        ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
        : undefined,
    thumbnail: product.imageUrl,
    images: [product.imageUrl],
    rating: {
      average: 0,
      count: 0,
    },
    availability: 'in_stock',
    stock: 100,
    isFeatured: Boolean(product.isFeatured),
    isTrending: false,
    isBestSeller: false,
    variants: [],
    reviews: [],
    tags: [],
  };
}

export default function ProductCard({ product, showFeaturedBadge = false, className }: ProductCardProps) {
  const cartStore = useStorefrontCartStore();
  const wishlistStore = useStorefrontWishlistStore();
  const openCartDrawer = useStorefrontUiStore((state) => state.openCartDrawer);
  const pushToast = useStorefrontUiStore((state) => state.pushToast);

  const normalized = toCardProduct(product);
  const isWishlisted = wishlistStore.items.some((item) => item.productId === normalized.id);
  const quantityInCart = cartStore.items
    .filter((item) => item.productId === normalized.id)
    .reduce((sum, item) => sum + item.quantity, 0);

  const handleAddToCart = () => {
    cartStore.addItem({ product: normalized, quantity: 1 });
    pushToast({
      variant: 'success',
      title: 'Added to cart',
      description: normalized.title,
    });
  };

  const handleToggleWishlist = () => {
    if (isWishlisted) {
      wishlistStore.removeFromWishlist(normalized.id);
      pushToast({
        variant: 'info',
        title: 'Removed from wishlist',
        description: normalized.title,
      });
      return;
    }

    wishlistStore.addToWishlist(normalized);
    pushToast({
      variant: 'success',
      title: 'Added to wishlist',
      description: normalized.title,
    });
  };

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/70 bg-white/88 shadow-[0_20px_48px_-30px_rgba(15,23,42,0.46)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_58px_-28px_rgba(15,23,42,0.52)]',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sky-100/35 to-transparent" />

      <div className="relative overflow-hidden bg-slate-100">
        <Link to={`/product/${normalized.slug}`} className="block" aria-label={`View ${normalized.title}`}>
          <img
            src={normalized.thumbnail}
            alt={normalized.title}
            loading="lazy"
            className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-110 sm:h-64"
            onError={(event) => {
              const image = event.currentTarget;
              image.onerror = null;
              image.src = buildProductPlaceholderImage(normalized.title);
            }}
          />
        </Link>

        <button
          type="button"
          onClick={handleToggleWishlist}
          className={cn(
            'absolute right-3 top-3 rounded-full border p-2 backdrop-blur transition',
            isWishlisted
              ? 'border-rose-200 bg-rose-50 text-rose-600'
              : 'border-white/80 bg-white/90 text-slate-600 hover:text-slate-900',
          )}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={cn('h-4 w-4', isWishlisted && 'fill-current')} />
        </button>

        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          {showFeaturedBadge && normalized.isFeatured ? <Badge variant="info">Featured</Badge> : null}
          {normalized.isTrending ? (
            <Badge variant="success" className="inline-flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Trending
            </Badge>
          ) : null}
          {normalized.isBestSeller ? <Badge variant="warning">Best Seller</Badge> : null}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <Link
            to={`/product/${normalized.slug}`}
            className="line-clamp-1 text-base font-semibold text-slate-900 hover:text-slate-700"
          >
            {normalized.title}
          </Link>
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{normalized.category}</p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-slate-900">{formatCurrency(normalized.price)}</p>
              {normalized.compareAtPrice ? (
                <p className="text-sm text-slate-400 line-through">{formatCurrency(normalized.compareAtPrice)}</p>
              ) : null}
            </div>
            {normalized.discountPercent ? (
              <p className="text-xs font-semibold text-emerald-700">{normalized.discountPercent}% OFF</p>
            ) : null}
          </div>

          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 px-2 py-1 text-xs font-medium text-slate-600">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span>{normalized.rating.average.toFixed(1)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleAddToCart}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <ShoppingCart className="h-4 w-4" />
            Add
          </button>

          <button
            type="button"
            onClick={openCartDrawer}
            className="rounded-full border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cart {quantityInCart > 0 ? `(${quantityInCart})` : ''}
          </button>
        </div>
      </div>
    </article>
  );
}
