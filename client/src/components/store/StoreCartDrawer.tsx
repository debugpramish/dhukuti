import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { buildProductPlaceholderImage } from '@/lib/image';
import { getCartItemCount, useStorefrontCartStore } from '@/stores/storefront-cart-store';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';

type StoreCartDrawerProps = {
  slug?: string;
  storeName?: string;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export default function StoreCartDrawer({ storeName = 'Dhukuti Store' }: StoreCartDrawerProps) {
  const isOpen = useStorefrontUiStore((state) => state.isCartDrawerOpen);
  const closeCartDrawer = useStorefrontUiStore((state) => state.closeCartDrawer);

  const { items, cartTotal, updateQuantity, removeItem, clearCart } = useStorefrontCartStore();
  const itemCount = useMemo(() => getCartItemCount(items), [items]);

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/55 backdrop-blur-[1px]"
          aria-label="Close cart drawer"
          onClick={closeCartDrawer}
        />
      ) : null}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md transform flex-col border-l border-slate-200/70 bg-white/96 shadow-[0_28px_70px_-30px_rgba(15,23,42,0.75)] backdrop-blur transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Shopping cart drawer"
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-cyan-50/70 px-4 py-4">
          <div>
            <p className="storefront-heading text-xl font-semibold text-slate-900">Your Cart</p>
            <p className="text-xs text-slate-500">
              {itemCount} {itemCount === 1 ? 'item' : 'items'} at {storeName}
            </p>
          </div>
          <button
            type="button"
            onClick={closeCartDrawer}
            className="rounded-full p-2 text-slate-600 transition hover:bg-white/80"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-500">
              <ShoppingBag className="h-8 w-8" />
              <p className="text-sm">Your cart is empty.</p>
              <Button type="button" variant="outline" onClick={closeCartDrawer}>
                Continue shopping
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article
                  key={`${item.productId}:${item.variantId || 'default'}`}
                  className="rounded-xl border border-slate-200/80 bg-white/85 p-3 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.75)]"
                >
                  <div className="flex gap-3">
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      className="h-16 w-16 rounded-md object-cover"
                      onError={(event) => {
                        const image = event.currentTarget;
                        image.onerror = null;
                        image.src = buildProductPlaceholderImage(item.title);
                      }}
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</p>
                      {item.variantLabel ? <p className="text-xs text-slate-500">{item.variantLabel}</p> : null}
                      <p className="text-sm text-slate-700">{formatCurrency(item.price)}</p>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="inline-flex items-center rounded-md border border-slate-200">
                          <button
                            type="button"
                            className="p-1.5 text-slate-600 hover:bg-slate-50"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            className="p-1.5 text-slate-600 hover:bg-slate-50"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.productId, item.variantId)}
                          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-rose-600"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-4 py-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-semibold text-slate-900">{formatCurrency(cartTotal)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={clearCart}>
              Clear
            </Button>
            <Link
              to="/cart"
              onClick={closeCartDrawer}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              View cart
            </Link>
          </div>

          <Link
            to="/checkout"
            onClick={closeCartDrawer}
            className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Checkout
          </Link>
        </div>
      </aside>
    </>
  );
}
