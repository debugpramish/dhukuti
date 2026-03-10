import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { fetchStorefrontStore, validateCoupon } from '@/features/storefront/api/storefrontApi';
import { formatCurrency, getDeliveryEstimate } from '@/features/storefront/utils';
import { buildProductPlaceholderImage } from '@/lib/image';
import { getCartItemCount, useStorefrontCartStore } from '@/stores/storefront-cart-store';
import { useStorefrontAuthStore } from '@/stores/storefront-auth-store';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';
import { useSeo } from '@/hooks/use-seo';

export default function CartPage() {
  useSeo({
    title: 'Cart',
    description: 'Review cart items, apply coupon, and proceed to checkout.',
  });

  const { items, cartTotal, updateQuantity, removeItem, clearCart } = useStorefrontCartStore();
  const itemCount = getCartItemCount(items);
  const authToken = useStorefrontAuthStore((state) => state.token);
  const pushToast = useStorefrontUiStore((state) => state.pushToast);
  const storeQuery = useQuery({
    queryKey: ['storefront', 'store-info'],
    queryFn: fetchStorefrontStore,
    retry: 0,
  });

  const [couponCode, setCouponCode] = useState('');
  const [couponState, setCouponState] = useState<{
    discountAmount: number;
    message: string;
    valid: boolean;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const freeShippingAbove = Math.max(0, storeQuery.data?.shippingRules?.freeShippingAbove ?? 0);
  const baseShippingFee = Math.max(0, storeQuery.data?.shippingRules?.baseFee ?? 0);
  const estimatedShipping = cartTotal >= freeShippingAbove ? 0 : baseShippingFee;
  const couponDiscount = couponState?.valid ? couponState.discountAmount : 0;

  const estimatedTotal = useMemo(() => {
    return Math.max(0, cartTotal - couponDiscount + estimatedShipping);
  }, [cartTotal, couponDiscount, estimatedShipping]);

  const handleApplyCoupon = async () => {
    setCouponLoading(true);

    try {
      const result = await validateCoupon(couponCode, cartTotal, authToken || undefined);
      setCouponState(result);
      pushToast({
        variant: result.valid ? 'success' : 'error',
        title: result.valid ? 'Coupon applied' : 'Coupon invalid',
        description: result.message,
      });
    } finally {
      setCouponLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="storefront-panel p-10 text-center">
        <h1 className="storefront-heading text-3xl font-semibold text-slate-900">Your cart is empty</h1>
        <p className="mt-2 text-sm text-slate-600">Add products from the shop to continue checkout.</p>
        <Link
          to="/shop"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Go to Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <section className="storefront-panel relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <span className="storefront-kicker">Basket</span>
            <h1 className="storefront-heading mt-2 text-3xl font-semibold text-slate-900">Shopping Cart</h1>
            <p className="text-sm text-slate-600">{itemCount} items ready for checkout.</p>
          </div>
          <Button type="button" variant="outline" onClick={clearCart} className="rounded-full px-4">
            Clear Cart
          </Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-3">
          {items.map((item) => (
            <article key={`${item.productId}:${item.variantId || 'default'}`} className="storefront-panel p-4">
              <div className="flex gap-4">
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  className="h-24 w-24 rounded-lg object-cover"
                  onError={(event) => {
                    const image = event.currentTarget;
                    image.onerror = null;
                    image.src = buildProductPlaceholderImage(item.title);
                  }}
                />

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link to={`/product/${item.slug}`} className="line-clamp-1 font-semibold text-slate-900 hover:text-slate-700">
                        {item.title}
                      </Link>
                      {item.variantLabel ? <p className="text-xs text-slate-500">{item.variantLabel}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId, item.variantId)}
                      className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                        className="p-2 text-slate-600 hover:bg-slate-50"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                        className="p-2 text-slate-600 hover:bg-slate-50"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="storefront-panel space-y-4 p-4">
          <h2 className="storefront-heading text-xl font-semibold text-slate-900">Order Summary</h2>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-600">Coupon code</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="SAVE10"
                className="storefront-input flex-1"
              />
              <Button type="button" variant="outline" onClick={handleApplyCoupon} disabled={couponLoading}>
                {couponLoading ? 'Applying' : 'Apply'}
              </Button>
            </div>
            {couponState ? (
              <p className={`text-xs ${couponState.valid ? 'text-emerald-700' : 'text-red-600'}`}>{couponState.message}</p>
            ) : null}
          </label>

          <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Coupon</span>
              <span>-{formatCurrency(couponDiscount)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Estimated shipping</span>
              <span>{estimatedShipping === 0 ? 'Free' : formatCurrency(estimatedShipping)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(estimatedTotal)}</span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            Estimated delivery by {getDeliveryEstimate(5)}.
          </div>

          <Link
            to="/checkout"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Proceed to Checkout
          </Link>
        </aside>
      </div>
    </div>
  );
}
