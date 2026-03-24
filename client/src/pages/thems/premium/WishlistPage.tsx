import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { fetchProductBySlug } from '@/features/storefront/api/storefrontApi';
import { formatCurrency } from '@/features/storefront/utils';
import { useSeo } from '@/hooks/use-seo';
import { useStorefrontCartStore } from '@/stores/storefront-cart-store';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';
import { useStorefrontWishlistStore } from '@/stores/storefront-wishlist-store';

export default function WishlistPage() {
  useSeo({
    title: 'Wishlist',
    description: 'Save products and move them into your cart anytime.',
  });

  const wishlistItems = useStorefrontWishlistStore((state) => state.items);
  const removeFromWishlist = useStorefrontWishlistStore((state) => state.removeFromWishlist);
  const addItem = useStorefrontCartStore((state) => state.addItem);
  const pushToast = useStorefrontUiStore((state) => state.pushToast);

  const handleMoveToCart = async (slug: string, productId: string) => {
    try {
      const product = await fetchProductBySlug(slug);
      addItem({ product, quantity: 1 });
      removeFromWishlist(productId);
      pushToast({
        variant: 'success',
        title: 'Moved to cart',
        description: product.title,
      });
    } catch (error) {
      pushToast({
        variant: 'error',
        title: 'Unable to move item',
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  };

  if (wishlistItems.length === 0) {
    return (
      <div className="premium-route premium-route-wishlist storefront-panel p-10 text-center">
        <h1 className="storefront-heading text-3xl font-semibold text-slate-900">Your private list is empty</h1>
        <p className="mt-2 text-sm text-slate-600">Add items from product pages to see them here.</p>
        <Link
          to="/shop"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="premium-route premium-route-wishlist space-y-7">
      <section className="storefront-panel p-6">
        <span className="storefront-kicker">Personal Archive</span>
        <h1 className="storefront-heading mt-2 text-3xl font-semibold text-slate-900">Saved Maison Picks</h1>
      </section>

      <div className="grid gap-3">
        {wishlistItems.map((item) => (
          <article key={item.productId} className="storefront-panel flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex items-center gap-3">
              <img src={item.image} alt={item.title} className="h-16 w-16 rounded-lg object-cover" loading="lazy" />
              <div>
                <Link to={`/product/${item.slug}`} className="line-clamp-1 font-semibold text-slate-900 hover:text-slate-700">
                  {item.title}
                </Link>
                <p className="text-sm text-slate-500">{formatCurrency(item.price)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => removeFromWishlist(item.productId)}>
                Remove
              </Button>
              <Button type="button" onClick={() => handleMoveToCart(item.slug, item.productId)}>
                Move to cart
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
