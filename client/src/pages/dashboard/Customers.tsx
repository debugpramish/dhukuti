import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import CustomerTable from '@/components/dashboard/CustomerTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { getOrders, updateOrderStatus } from '@/services/api/orderApi';
import type { Order, OrderStatus } from '@/services/api/types';

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

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const { data: orders, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: getOrders,
    retry: 1,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      updateOrderStatus(orderId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    setStatusError(null);

    updateStatusMutation.mutate(
      { orderId, status },
      {
        onError: (requestError) => {
          const message = requestError instanceof Error ? requestError.message : 'Unable to update order status.';
          setStatusError(message);
        },
      },
    );
  };

  const updatingOrderId = updateStatusMutation.isPending
    ? (updateStatusMutation.variables?.orderId ?? null)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
        <p className="text-sm text-muted-foreground">
          View customer checkout details, ordered items, bill, and current order status.
        </p>
      </div>

      {statusError ? <p className="text-sm text-destructive">{statusError}</p> : null}

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading customers...</CardContent>
        </Card>
      ) : null}

      {isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load customer orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Request failed'}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !isError && orders && orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No customer orders yet.
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !isError && orders && orders.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Customer Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerTable
              orders={orders}
              updatingOrderId={updatingOrderId}
              onStatusChange={handleStatusChange}
              onViewOrder={(order) => setSelectedOrder(order)}
            />
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={selectedOrder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
          }
        }}
        title={selectedOrder ? `Customer Order #${selectedOrder.orderNumber}` : 'Customer order details'}
        description={
          selectedOrder ? `Placed on ${formatDate(selectedOrder.createdAt)} by ${selectedOrder.customerName}.` : undefined
        }
      >
        {!selectedOrder ? null : (
          <div className="space-y-4">
            <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Customer Info</p>
                <p className="font-medium text-foreground">{selectedOrder.customerName}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customerEmail}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customerPhone || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customerLocation || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Order Status</p>
                <p className="font-medium text-foreground">{formatStatus(selectedOrder.status)}</p>
                <p className="text-sm text-muted-foreground">Subtotal: {formatCurrency(selectedOrder.subtotal)}</p>
                <p className="text-sm text-muted-foreground">
                  Product discounts: {formatCurrency(selectedOrder.productDiscountTotal)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Coupon ({selectedOrder.couponCode || 'N/A'}): {formatCurrency(selectedOrder.couponDiscountTotal)}
                </p>
                <p className="text-sm font-medium text-foreground">Final total: {formatCurrency(selectedOrder.total)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Items</h3>
              <div className="space-y-2 rounded-lg border p-3">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium text-foreground">{formatCurrency(item.unitPrice * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

