import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import CustomerTable from '@/components/dashboard/CustomerTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebounce } from '@/hooks/use-debounce';
import { getStoreCustomers } from '@/services/api/customerApi';
import { getOrders, updateOrderStatus } from '@/services/api/orderApi';
import { getStoreSettings } from '@/services/api/storeApi';
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
  const [customerPage, setCustomerPage] = useState(1);
  const [customerSearch, setCustomerSearch] = useState('');

  const debouncedCustomerSearch = useDebounce(customerSearch, 350);

  const { data: storeSettings } = useQuery({
    queryKey: ['store-settings'],
    queryFn: getStoreSettings,
    retry: 1,
  });

  const activeStoreSlug = String(storeSettings?.slug || '').trim().toLowerCase();

  const {
    data: storeCustomers,
    isLoading: isLoadingStoreCustomers,
    isError: isStoreCustomersError,
    error: storeCustomersError,
    isFetching: isFetchingStoreCustomers,
    refetch: refetchStoreCustomers,
  } = useQuery({
    queryKey: ['store-customers', activeStoreSlug, customerPage, debouncedCustomerSearch],
    queryFn: () =>
      getStoreCustomers({
        slug: activeStoreSlug,
        page: customerPage,
        limit: 20,
        search: debouncedCustomerSearch,
      }),
    enabled: activeStoreSlug.length > 0,
    retry: 1,
    placeholderData: (previousData) => previousData,
  });

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

  const customerPagination = storeCustomers?.pagination;
  const canGoToPreviousCustomerPage = (customerPagination?.page ?? 1) > 1;
  const canGoToNextCustomerPage = customerPagination?.hasNextPage ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
        <p className="text-sm text-muted-foreground">
          View customer checkout details, ordered items, bill, and current order status.
        </p>
      </div>

      {statusError ? <p className="text-sm text-destructive">{statusError}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Store Customer Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={customerSearch}
              onChange={(event) => {
                setCustomerSearch(event.target.value);
                setCustomerPage(1);
              }}
              placeholder="Search by name, email, or phone"
              className="sm:max-w-sm"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => void refetchStoreCustomers()}
              disabled={isFetchingStoreCustomers || activeStoreSlug.length === 0}
            >
              {isFetchingStoreCustomers ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {activeStoreSlug ? (
            <p className="text-xs text-muted-foreground">Store scope: {activeStoreSlug}</p>
          ) : (
            <p className="text-xs text-destructive">Store context is not available for customer listing.</p>
          )}

          {isLoadingStoreCustomers ? (
            <p className="text-sm text-muted-foreground">Loading store customers...</p>
          ) : null}

          {isStoreCustomersError ? (
            <p className="text-sm text-destructive">
              {storeCustomersError instanceof Error ? storeCustomersError.message : 'Unable to load store customers'}
            </p>
          ) : null}

          {!isLoadingStoreCustomers && !isStoreCustomersError && storeCustomers ? (
            <>
              {storeCustomers.customers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No customers found for this store.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storeCustomers.customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.email}</p>
                        </TableCell>
                        <TableCell className="text-sm">{customer.phone || 'N/A'}</TableCell>
                        <TableCell className="text-sm">{customer.address || 'N/A'}</TableCell>
                        <TableCell className="text-sm">{formatDate(customer.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Page {customerPagination?.page ?? 1} of {customerPagination?.totalPages ?? 1} | Total customers:{' '}
                  {customerPagination?.total ?? storeCustomers.customers.length}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canGoToPreviousCustomerPage || isFetchingStoreCustomers}
                    onClick={() => setCustomerPage((currentPage) => Math.max(1, currentPage - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canGoToNextCustomerPage || isFetchingStoreCustomers}
                    onClick={() => setCustomerPage((currentPage) => currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

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

