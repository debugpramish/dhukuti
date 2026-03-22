import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { IndianRupee, Package, ShoppingBag, TrendingUp } from 'lucide-react';

import OrderTrendsChart from '@/components/dashboard/OrderTrendsChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getDashboardOrderTrends, getDashboardSummary } from '@/services/api/dashboardApi';
import { getProducts } from '@/services/api/productApi';
import type { OrderStatus, Product } from '@/services/api/types';
import { cn } from '@/lib/utils';

const statusBadgeMap: Record<OrderStatus, string> = {
  pending:
    'border-amber-200 bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-900',
  confirmed: 'border-sky-200 bg-gradient-to-r from-sky-100 to-blue-100 text-blue-900',
  shipped: 'border-indigo-200 bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-900',
  delivered:
    'border-emerald-200 bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-900',
  cancelled: 'border-rose-200 bg-gradient-to-r from-rose-100 to-red-100 text-rose-900',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatStatus(status: OrderStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTrendPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export default function OverviewPage() {
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    retry: 1,
  });

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
    retry: 1,
  });

  const trendsQuery = useQuery({
    queryKey: ['dashboard-order-trends', selectedProductId],
    queryFn: () => getDashboardOrderTrends(selectedProductId || undefined),
    retry: 1,
  });

  const productOptions = useMemo(() => {
    const list = productsQuery.data ?? [];

    return [...list].sort((a: Product, b: Product) => a.title.localeCompare(b.title));
  }, [productsQuery.data]);

  const isLoading = summaryQuery.isLoading || trendsQuery.isLoading;
  const isError = summaryQuery.isError || trendsQuery.isError;
  const queryError = summaryQuery.error ?? trendsQuery.error;

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 p-6"
        style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}
      >
        <Card className="mx-auto max-w-md border-slate-200/80 shadow-lg shadow-slate-900/5">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-64 animate-pulse rounded bg-slate-200" />
            <p className="text-sm text-slate-500">Loading dashboard summary...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 p-6"
        style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}
      >
        <Card className="mx-auto max-w-md border-slate-200/80 shadow-lg shadow-slate-900/5">
          <CardHeader>
            <CardTitle className="text-slate-900">Unable to load dashboard summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-rose-600">
              {queryError instanceof Error ? queryError.message : 'Request failed'}
            </p>
            <button
              type="button"
              onClick={() => {
                void summaryQuery.refetch();
                void trendsQuery.refetch();
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-indigo-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!summaryQuery.data || !trendsQuery.data) {
    return null;
  }

  const data = summaryQuery.data;
  const monthTrend = trendsQuery.data.month;
  const selectedProduct = productOptions.find((product) => product.id === selectedProductId) ?? null;
  const trendColorClass =
    monthTrend.direction === 'up'
      ? 'text-emerald-600'
      : monthTrend.direction === 'down'
        ? 'text-rose-600'
        : 'text-slate-500';

  return (
    <div
      className="space-y-6 rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 p-4 sm:p-6"
      style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Dashboard Overview
        </h1>
        <p className="text-sm text-slate-500 sm:text-base">
          Monitor product count, order flow, and revenue performance.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-200/60 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Total Products
              </p>
              <p className="text-4xl font-bold tracking-tight text-slate-900">
                {data.totalProducts.toLocaleString('en-US')}
              </p>
              <p className="mt-2 text-xs text-slate-500">Products currently in your catalog</p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-400 text-white shadow-lg shadow-indigo-300/60">
              <Package className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-5 text-xs font-medium text-slate-500">Total items currently listed</p>
        </article>

        <article className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-yellow-100/60 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-200/60 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Total Orders
              </p>
              <p className="text-4xl font-bold tracking-tight text-slate-900">
                {data.totalOrders.toLocaleString('en-US')}
              </p>
              <p className="mt-2 text-xs text-slate-500">Orders placed across your storefront</p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-400 text-white shadow-lg shadow-amber-300/60">
              <ShoppingBag className="h-5 w-5" />
            </span>
          </div>
          <p className={cn('mt-5 inline-flex items-center gap-1 text-xs font-semibold', trendColorClass)}>
            <TrendingUp className="h-3.5 w-3.5" />
            {formatTrendPercent(monthTrend.changePercent)} vs previous month
          </p>
        </article>

        <article className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-green-100/60 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-200/60 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Total Revenue
              </p>
              <p className="text-4xl font-bold tracking-tight text-slate-900">
                {formatCurrency(data.totalRevenue)}
              </p>
              <p className="mt-2 text-xs text-slate-500">Gross revenue from all completed checkouts</p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-300/60">
              <IndianRupee className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-5 text-xs font-medium text-slate-500">Revenue from non-cancelled orders</p>
        </article>
      </section>

      <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-slate-800">Order Trends</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                {selectedProduct
                  ? `Order trend for ${selectedProduct.title}`
                  : 'Order trend across all products'}
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Product
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium normal-case tracking-normal text-slate-700 outline-none transition-colors focus:border-indigo-300 focus:bg-white"
              >
                <option value="">All products</option>
                {productOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <OrderTrendsChart trends={trendsQuery.data} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-800">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="border-y border-slate-100">
                <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Order ID
                </TableHead>
                <TableHead className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Customer
                </TableHead>
                <TableHead className="hidden px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 sm:table-cell">
                  Date
                </TableHead>
                <TableHead className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Total
                </TableHead>
                <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentOrders.slice(0, 5).map((order) => (
                <TableRow
                  key={order.id}
                  className="border-b border-slate-50 transition-colors hover:bg-gradient-to-r hover:from-indigo-50/40 hover:to-indigo-50/10"
                >
                  <TableCell className="px-6 py-3.5 font-semibold text-slate-800">
                    #{order.orderNumber}
                  </TableCell>
                  <TableCell className="px-3 py-3.5 text-slate-600">{order.customerName}</TableCell>
                  <TableCell className="hidden px-3 py-3.5 text-slate-400 sm:table-cell">
                    {formatDate(order.createdAt)}
                  </TableCell>
                  <TableCell className="px-3 py-3.5 text-right font-medium text-slate-700">
                    {formatCurrency(order.total)}
                  </TableCell>
                  <TableCell className="px-6 py-3.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide shadow-sm transition-transform hover:-translate-y-0.5',
                        statusBadgeMap[order.status],
                      )}
                    >
                      {formatStatus(order.status)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3.5">
            <p className="text-xs text-slate-400">
              Showing {Math.min(5, data.recentOrders.length)} of {data.totalOrders.toLocaleString('en-US')} orders
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
