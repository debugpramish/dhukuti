import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, Minus, Plus, Star } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import Skeleton from '@/components/common/Skeleton';
import ProductCard from '@/components/store/ProductCard';
import { Button } from '@/components/ui/button';
import { storefrontQueryKeys } from '@/features/storefront/api/queryKeys';
import { fetchProductBySlug, fetchRelatedProducts } from '@/features/storefront/api/storefrontApi';
import { formatCurrency } from '@/features/storefront/utils';
import { useSeo } from '@/hooks/use-seo';
import { useRecentlyViewedStore } from '@/stores/storefront-recently-viewed-store';
import { useStorefrontCartStore } from '@/stores/storefront-cart-store';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';
import { useStorefrontWishlistStore } from '@/stores/storefront-wishlist-store';

export default function ProductPage() {
  const slug = String(useParams().slug || '').trim();

  const [selectedImage, setSelectedImage] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);

  const trackProduct = useRecentlyViewedStore((state) => state.trackProduct);
  const addItem = useStorefrontCartStore((state) => state.addItem);
  const openCartDrawer = useStorefrontUiStore((state) => state.openCartDrawer);
  const pushToast = useStorefrontUiStore((state) => state.pushToast);
  const wishlistItems = useStorefrontWishlistStore((state) => state.items);
  const addToWishlist = useStorefrontWishlistStore((state) => state.addToWishlist);
  const removeFromWishlist = useStorefrontWishlistStore((state) => state.removeFromWishlist);

  const productQuery = useQuery({
    queryKey: storefrontQueryKeys.productDetail(slug),
    queryFn: () => fetchProductBySlug(slug),
    enabled: slug.length > 0,
  });

  const relatedProductsQuery = useQuery({
    queryKey: storefrontQueryKeys.relatedProducts(slug),
    queryFn: () => fetchRelatedProducts(slug, 4),
    enabled: slug.length > 0,
  });

  const product = productQuery.data;
  const defaultVariant = useMemo(
    () => product?.variants.find((variant) => variant.isDefault) || product?.variants[0],
    [product],
  );
  const activeVariantId = useMemo(() => {
    if (!product) {
      return '';
    }

    const selectedIsValid = selectedVariantId
      ? product.variants.some((variant) => variant.id === selectedVariantId)
      : false;

    return selectedIsValid ? selectedVariantId : defaultVariant?.id || '';
  }, [defaultVariant?.id, product, selectedVariantId]);
  const selectedVariant = useMemo(
    () => product?.variants.find((variant) => variant.id === activeVariantId),
    [activeVariantId, product],
  );
  const activeImage = useMemo(() => {
    if (!product) {
      return '';
    }

    const selectedIsValid = selectedImage ? product.images.includes(selectedImage) : false;
    return selectedIsValid ? selectedImage : product.images[0] || product.thumbnail;
  }, [product, selectedImage]);
  const isWishlisted = useMemo(
    () => Boolean(product && wishlistItems.some((item) => item.productId === product.id)),
    [product, wishlistItems],
  );

  useSeo({
    title: product ? product.title : 'Product',
    description: product?.shortDescription || product?.description || 'Product details and reviews.',
  });

  useEffect(() => {
    if (!product) {
      return;
    }

    trackProduct(product);
  }, [product, trackProduct]);

  const handleAddToCart = () => {
    if (!product) {
      return;
    }

    addItem({
      product,
      quantity,
      variantId: selectedVariant?.id,
      variantLabel: selectedVariant ? `${selectedVariant.name}: ${selectedVariant.value}` : undefined,
    });

    pushToast({
      variant: 'success',
      title: 'Added to cart',
      description: `${quantity} x ${product.title}`,
    });

    openCartDrawer();
  };

  const handleWishlistToggle = () => {
    if (!product) {
      return;
    }

    if (isWishlisted) {
      removeFromWishlist(product.id);
      pushToast({
        variant: 'info',
        title: 'Removed from wishlist',
        description: product.title,
      });
      return;
    }

    addToWishlist(product);
    pushToast({
      variant: 'success',
      title: 'Added to wishlist',
      description: product.title,
    });
  };

  if (!slug) {
    return (
      <div className="storefront-panel p-6 text-sm text-slate-600">
        Invalid product URL.
      </div>
    );
  }

  if (productQuery.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[420px]" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <div className="rounded-xl border border-red-200/80 bg-red-50/90 p-5 text-sm text-red-700">
        Unable to load this product. <Link to="/shop" className="underline">Back to shop</Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="storefront-panel overflow-hidden">
            <img
              src={activeImage || product.thumbnail}
              alt={product.title}
              className="h-[420px] w-full object-cover transition duration-500 hover:scale-105"
              loading="lazy"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {product.images.map((image) => (
              <button
                key={image}
                type="button"
                onClick={() => setSelectedImage(image)}
                className={`overflow-hidden rounded-xl border transition ${activeImage === image ? 'border-slate-900 ring-2 ring-slate-200' : 'border-slate-200/80'}`}
              >
                <img src={image} alt={product.title} className="h-20 w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>

        <div className="storefront-panel space-y-5 p-6">
          <div>
            <span className="storefront-kicker">{product.category}</span>
            <h1 className="storefront-heading mt-2 text-3xl font-semibold text-slate-900">{product.title}</h1>
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {product.rating.average.toFixed(1)} ({product.rating.count})
            </div>
          </div>

          <div className="space-y-0.5">
            <p className="text-2xl font-semibold text-slate-900">{formatCurrency(product.price)}</p>
            {product.compareAtPrice ? (
              <p className="text-sm text-slate-500 line-through">{formatCurrency(product.compareAtPrice)}</p>
            ) : null}
            {product.discountPercent ? (
              <p className="text-sm font-medium text-emerald-700">{product.discountPercent}% OFF</p>
            ) : null}
          </div>

          {product.variants.length > 0 ? (
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-slate-700">Variant</span>
              <select
                value={activeVariantId}
                onChange={(event) => setSelectedVariantId(event.target.value)}
                className="storefront-select"
              >
                {product.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}: {variant.value}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                className="p-2 text-slate-600 hover:bg-slate-50"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-10 text-center text-sm">{quantity}</span>
              <button
                type="button"
                className="p-2 text-slate-600 hover:bg-slate-50"
                onClick={() => setQuantity((current) => Math.min(20, current + 1))}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <Button type="button" onClick={handleAddToCart} className="rounded-full px-5">
              Add to cart
            </Button>

            <Button type="button" variant="outline" onClick={handleWishlistToggle} className="rounded-full px-4">
              <Heart className={`mr-1.5 h-4 w-4 ${isWishlisted ? 'fill-current text-rose-500' : ''}`} />
              {isWishlisted ? 'Saved' : 'Wishlist'}
            </Button>
          </div>

          <div className="rounded-xl bg-slate-50/90 p-3 text-sm text-slate-600">
            {product.description || 'No description available.'}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Customer Reviews</h2>

        {product.reviews.length === 0 ? (
          <div className="storefront-panel p-4 text-sm text-slate-500">
            No reviews yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {product.reviews.slice(0, 4).map((review) => (
              <article key={review.id} className="storefront-panel p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{review.author}</p>
                  <p className="text-xs text-slate-500">{new Date(review.createdAt).toLocaleDateString()}</p>
                </div>
                <p className="mb-2 text-xs text-amber-600">{'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}</p>
                <p className="text-sm text-slate-600">{review.content}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Related Products</h2>

        {relatedProductsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={String(index)} className="h-80" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(relatedProductsQuery.data || []).slice(0, 4).map((related) => (
              <ProductCard key={related.id} product={related} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
