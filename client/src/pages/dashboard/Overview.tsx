import { useQuery } from '@tanstack/react-query';
import { DollarSign, Package, ShoppingBag } from 'lucide-react';

import OrderTrendsChart from '@/components/dashboard/OrderTrendsChart';
import StatsCard from '@/components/dashboard/StatsCard';
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
import type { OrderStatus } from '@/services/api/types';

const statusColorMap: Record<OrderStatus, string> = {
  pending: 'text-amber-600',
  confirmed: 'text-sky-600',
  shipped: 'text-indigo-600',
  delivered: 'text-emerald-600',
  cancelled: 'text-rose-600',
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

export default function OverviewPage() {
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    retry: 1,
  });
  const trendsQuery = useQuery({
    queryKey: ['dashboard-order-trends'],
    queryFn: getDashboardOrderTrends,
    retry: 1,
  });

  const isLoading = summaryQuery.isLoading || trendsQuery.isLoading;
  const isError = summaryQuery.isError || trendsQuery.isError;
  const queryError = summaryQuery.error ?? trendsQuery.error;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading dashboard summary...
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unable to load dashboard summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive">{queryError instanceof Error ? queryError.message : 'Request failed'}</p>
          <button
            type="button"
            onClick={() => {
              void summaryQuery.refetch();
              void trendsQuery.refetch();
            }}
            className="rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!summaryQuery.data || !trendsQuery.data) {
    return null;
  }

  const data = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground">Monitor product count, order flow, and revenue performance.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard
          title="Total Products"
          value={String(data.totalProducts)}
          description="Products currently in your catalog"
          icon={Package}
        />
        <StatsCard
          title="Total Orders"
          value={String(data.totalOrders)}
          description="Orders placed across your storefront"
          icon={ShoppingBag}
        />
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(data.totalRevenue)}
          description="Gross revenue from all completed checkouts"
          icon={DollarSign}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Order Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTrendsChart trends={trendsQuery.data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentOrders.slice(0, 5).map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>{formatCurrency(order.total)}</TableCell>
                  <TableCell className={statusColorMap[order.status]}>{formatStatus(order.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
