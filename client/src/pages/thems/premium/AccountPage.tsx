import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { storefrontQueryKeys } from '@/features/storefront/api/queryKeys';
import { fetchCustomerOrders, fetchProductBySlug } from '@/features/storefront/api/storefrontApi';
import { formatCurrency, formatDate } from '@/features/storefront/utils';
import { useSeo } from '@/hooks/use-seo';
import { useStorefrontAuthStore } from '@/stores/storefront-auth-store';
import { useStorefrontCartStore } from '@/stores/storefront-cart-store';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';
import { useStorefrontWishlistStore } from '@/stores/storefront-wishlist-store';

type AccountTab = 'profile' | 'orders' | 'addresses' | 'wishlist';

type AccountPageProps = {
  initialTab?: AccountTab;
};

const tabs: Array<{ value: AccountTab; label: string }> = [
  { value: 'profile', label: 'Profile' },
  { value: 'orders', label: 'Orders' },
  { value: 'addresses', label: 'Addresses' },
  { value: 'wishlist', label: 'Wishlist' },
];

export default function AccountPage({ initialTab = 'profile' }: AccountPageProps) {
  useSeo({
    title: 'Account',
    description: 'Manage profile, order history, addresses, and wishlist.',
  });

  const { user, token, isAuthenticated, logout } = useStorefrontAuthStore();
  const pushToast = useStorefrontUiStore((state) => state.pushToast);
  const wishlistItems = useStorefrontWishlistStore((state) => state.items);
  const removeFromWishlist = useStorefrontWishlistStore((state) => state.removeFromWishlist);
  const addItem = useStorefrontCartStore((state) => state.addItem);

  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);

  const ordersQuery = useQuery({
    queryKey: storefrontQueryKeys.customerOrders,
    queryFn: () => fetchCustomerOrders(token),
    enabled: isAuthenticated && Boolean(token),
  });

  const defaultAddress = useMemo(() => user?.addresses?.[0], [user]);

  if (!isAuthenticated || !token || !user) {
    return <Navigate to="/login?next=%2Faccount" replace />;
  }

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
        description: error instanceof Error ? error.message : 'Try again',
      });
    }
  };

  return (
    <div className="premium-route premium-route-account space-y-7">
      <section className="storefront-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="storefront-kicker">Client Suite</span>
            <h1 className="storefront-heading mt-2 text-3xl font-semibold text-slate-900">Maison Account Center</h1>
            <p className="text-sm text-slate-600">{user.name} ({user.email})</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full px-4"
            onClick={() => {
              logout();
              pushToast({ variant: 'info', title: 'Logged out' });
            }}
          >
            Logout
          </Button>
        </div>
      </section>

      <div className="storefront-panel flex flex-wrap gap-2 p-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-full px-3.5 py-2 text-sm ${activeTab === tab.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="storefront-panel p-5">
        {activeTab === 'profile' ? (
          <div className="space-y-2 text-sm">
            <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Profile</h2>
            <p><span className="text-slate-500">Name:</span> {user.name}</p>
            <p><span className="text-slate-500">Email:</span> {user.email}</p>
            <p><span className="text-slate-500">Phone:</span> {user.phone || 'Not set'}</p>
          </div>
        ) : null}

        {activeTab === 'orders' ? (
          <div className="space-y-3">
            <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Orders</h2>

            {ordersQuery.isLoading ? <p className="text-sm text-slate-500">Loading orders...</p> : null}
            {ordersQuery.isError ? <p className="text-sm text-red-600">Unable to load orders.</p> : null}

            {(ordersQuery.data || []).length === 0 && !ordersQuery.isLoading ? (
              <p className="text-sm text-slate-500">No orders yet.</p>
            ) : null}

            <div className="space-y-2">
              {(ordersQuery.data || []).map((order) => (
                <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">Order #{order.orderNumber}</p>
                      <p className="text-xs text-slate-500">Placed on {formatDate(order.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(order.payment.total)}</p>
                      <p className="text-xs uppercase text-slate-500">{order.status}</p>
                    </div>
                  </div>

                  <div className="mt-2">
                    <Link
                      to={`/order-confirmation/${encodeURIComponent(order.id)}`}
                      className="text-xs font-medium text-slate-700 hover:text-slate-900"
                    >
                      View order details
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === 'addresses' ? (
          <div className="space-y-2 text-sm">
            <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Addresses</h2>
            {defaultAddress ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="font-medium text-slate-900">Default Address</p>
                <p className="text-slate-600">{defaultAddress.address}</p>
                <p className="text-slate-600">{defaultAddress.city}, {defaultAddress.postalCode}</p>
                <p className="text-slate-600">{defaultAddress.country}</p>
              </div>
            ) : (
              <p className="text-slate-500">No saved addresses. Checkout will let you add one.</p>
            )}
          </div>
        ) : null}

        {activeTab === 'wishlist' ? (
          <div className="space-y-3">
            <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Wishlist</h2>

            {wishlistItems.length === 0 ? <p className="text-sm text-slate-500">Your wishlist is empty.</p> : null}

            <div className="space-y-2">
              {wishlistItems.map((item) => (
                <article key={item.productId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/product/${item.slug}`} className="line-clamp-1 font-medium text-slate-900 hover:text-slate-700">
                      {item.title}
                    </Link>
                    <p className="text-xs text-slate-500">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => removeFromWishlist(item.productId)}>
                      Remove
                    </Button>
                    <Button type="button" size="sm" onClick={() => handleMoveToCart(item.slug, item.productId)}>
                      Move to cart
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
