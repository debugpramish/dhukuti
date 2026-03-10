import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { storefrontQueryKeys } from '@/features/storefront/api/queryKeys';
import { fetchOrderById } from '@/features/storefront/api/storefrontApi';
import { formatCurrency, formatDate, getDeliveryEstimate } from '@/features/storefront/utils';
import { useSeo } from '@/hooks/use-seo';
import { useStorefrontAuthStore } from '@/stores/storefront-auth-store';

export default function OrderConfirmationPage() {
  const orderId = String(useParams().orderId || '').trim();
  const token = useStorefrontAuthStore((state) => state.token);

  const orderQuery = useQuery({
    queryKey: storefrontQueryKeys.customerOrder(orderId),
    queryFn: () => fetchOrderById(orderId, token || undefined),
    enabled: orderId.length > 0,
  });

  useSeo({
    title: orderId ? `Order ${orderId}` : 'Order Confirmation',
    description: 'Track your order details, shipping information, and payment summary.',
  });

  if (!orderId) {
    return <div className="storefront-panel p-5 text-sm text-slate-600">Invalid order ID.</div>;
  }

  if (orderQuery.isLoading) {
    return <div className="storefront-panel p-5 text-sm text-slate-600">Loading order details...</div>;
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Unable to fetch order details.
      </div>
    );
  }

  const order = orderQuery.data;

  return (
    <div className="space-y-7">
      <section className="storefront-panel rounded-2xl border-emerald-200 bg-emerald-50/90 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          <div>
            <h1 className="storefront-heading text-3xl font-semibold text-emerald-900">Order Confirmed</h1>
            <p className="text-sm text-emerald-800">
              Order number: <span className="font-semibold">{order.orderNumber || order.id}</span>
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="storefront-panel space-y-4 p-5">
          <div>
            <h2 className="storefront-heading text-2xl font-semibold text-slate-900">Order Items</h2>
            <p className="text-sm text-slate-500">Placed on {formatDate(order.createdAt)}</p>
          </div>

          <div className="space-y-2">
            {order.items.map((item) => (
              <article key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-slate-500">Qty {item.quantity}</p>
                </div>
                <p className="font-medium text-slate-900">{formatCurrency(item.subtotal)}</p>
              </article>
            ))}
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Delivery estimate: {order.estimatedDelivery || getDeliveryEstimate(5)}
          </div>
        </section>

        <aside className="storefront-panel space-y-4 p-4 text-sm">
          <div>
            <h2 className="storefront-heading text-xl font-semibold text-slate-900">Shipping Address</h2>
            <p className="mt-1 text-slate-600">{order.shippingAddress.name}</p>
            <p className="text-slate-600">{order.shippingAddress.address}</p>
            <p className="text-slate-600">
              {order.shippingAddress.city}, {order.shippingAddress.postalCode}
            </p>
            <p className="text-slate-600">{order.shippingAddress.country}</p>
            <p className="text-slate-600">{order.shippingAddress.phone}</p>
          </div>

          <div className="space-y-1 border-t border-slate-200 pt-3">
            <h2 className="storefront-heading text-xl font-semibold text-slate-900">Payment Summary</h2>
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(order.payment.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Discount</span>
              <span>-{formatCurrency(order.payment.discountTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Shipping</span>
              <span>{formatCurrency(order.payment.shipping)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Tax</span>
              <span>{formatCurrency(order.payment.tax)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(order.payment.total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/account/orders"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              My Orders
            </Link>
            <Link
              to="/shop"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Continue Shopping
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
