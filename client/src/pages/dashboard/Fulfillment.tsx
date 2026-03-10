import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createShipment,
  getCourierOptions,
  getCourierQuotes,
  getFulfillmentOrders,
  getShippingRules,
  updateCodTracking,
  updateShipmentStatus,
  updateShippingRules,
} from '@/services/api/fulfillmentApi';
import {
  ORDER_COD_STATUS_VALUES,
  SHIPMENT_STATUS_VALUES,
  STORE_COURIER_VALUES,
  type OrderCodStatus,
  type ShipmentStatus,
  type ShippingRules,
  type StoreCourier,
} from '@/services/api/types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return 'N/A';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCourierLabel(courier: string): string {
  if (courier === 'nepal-post') {
    return 'Nepal Post';
  }

  if (courier === 'pathao') {
    return 'Pathao';
  }

  if (courier === 'delivery-sathi') {
    return 'Delivery Sathi';
  }

  return courier;
}

function formatShipmentStatus(status: ShipmentStatus): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function shipmentBadgeVariant(status: ShipmentStatus): 'warning' | 'info' | 'secondary' | 'success' | 'destructive' {
  if (status === 'failed') {
    return 'destructive';
  }

  if (status === 'delivered') {
    return 'success';
  }

  if (status === 'label_generated') {
    return 'info';
  }

  if (status === 'in_transit' || status === 'out_for_delivery' || status === 'picked_up') {
    return 'secondary';
  }

  return 'warning';
}

function codBadgeVariant(status: OrderCodStatus): 'warning' | 'success' | 'destructive' | 'muted' {
  if (status === 'collected') {
    return 'success';
  }

  if (status === 'failed') {
    return 'destructive';
  }

  if (status === 'not_applicable') {
    return 'muted';
  }

  return 'warning';
}

function paymentBadgeVariant(status: string): 'warning' | 'success' | 'destructive' | 'muted' {
  if (status === 'paid') {
    return 'success';
  }

  if (status === 'failed') {
    return 'destructive';
  }

  if (status === 'refunded') {
    return 'muted';
  }

  return 'warning';
}

export default function FulfillmentPage() {
  const queryClient = useQueryClient();
  const [rulesDraftOverride, setRulesDraftOverride] = useState<ShippingRules | null>(null);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [selectedCourierByOrderId, setSelectedCourierByOrderId] = useState<Record<string, StoreCourier>>({});
  const [quoteDestination, setQuoteDestination] = useState('');
  const [quoteWeight, setQuoteWeight] = useState('1');
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const shippingRulesQuery = useQuery({
    queryKey: ['fulfillment-shipping-rules'],
    queryFn: getShippingRules,
    retry: 1,
  });

  const fulfillmentOrdersQuery = useQuery({
    queryKey: ['fulfillment-orders'],
    queryFn: getFulfillmentOrders,
    retry: 1,
  });

  const couriersQuery = useQuery({
    queryKey: ['fulfillment-couriers'],
    queryFn: getCourierOptions,
    retry: 1,
  });

  const rulesDraft = rulesDraftOverride ?? shippingRulesQuery.data ?? null;

  const updateRulesDraft = (updater: (currentRules: ShippingRules) => ShippingRules) => {
    setRulesDraftOverride((currentRules) => {
      const baseRules = currentRules ?? shippingRulesQuery.data;
      if (!baseRules) {
        return currentRules;
      }

      return updater(baseRules);
    });
  };

  const saveShippingRulesMutation = useMutation({
    mutationFn: (payload: ShippingRules) => updateShippingRules(payload),
    onSuccess: async (updatedRules) => {
      setRulesDraftOverride(updatedRules);
      setSettingsFeedback('Shipping settings updated.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fulfillment-shipping-rules'] }),
        queryClient.invalidateQueries({ queryKey: ['store-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['public-store'] }),
      ]);
    },
  });

  const createShipmentMutation = useMutation({
    mutationFn: ({ orderId, courier }: { orderId: string; courier?: StoreCourier }) =>
      createShipment(orderId, { courier }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fulfillment-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
    },
  });

  const updateShipmentStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: ShipmentStatus }) =>
      updateShipmentStatus(orderId, { status }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fulfillment-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
    },
  });

  const updateCodTrackingMutation = useMutation({
    mutationFn: ({ orderId, codStatus, collectedAmount }: { orderId: string; codStatus: OrderCodStatus; collectedAmount?: number }) =>
      updateCodTracking(orderId, { codStatus, collectedAmount }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fulfillment-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ]);
    },
  });

  const courierQuoteMutation = useMutation({
    mutationFn: ({ destination, weightKg }: { destination: string; weightKg: number }) =>
      getCourierQuotes(destination, weightKg),
  });

  const creatingShipmentOrderId = createShipmentMutation.isPending ? createShipmentMutation.variables?.orderId : null;
  const updatingShipmentOrderId = updateShipmentStatusMutation.isPending
    ? updateShipmentStatusMutation.variables?.orderId
    : null;
  const updatingCodOrderId = updateCodTrackingMutation.isPending ? updateCodTrackingMutation.variables?.orderId : null;
  const courierOptionIds = couriersQuery.data && couriersQuery.data.length > 0
    ? couriersQuery.data.map((courier) => courier.id)
    : [...STORE_COURIER_VALUES];

  const handleSaveShippingRules = async () => {
    setSettingsError(null);
    setSettingsFeedback(null);

    if (!rulesDraft) {
      setSettingsError('Shipping settings are not ready yet.');
      return;
    }

    const normalizedSupportedCouriers = rulesDraft.supportedCouriers.filter(
      (courier, index, list) => list.indexOf(courier) === index,
    );

    if (normalizedSupportedCouriers.length === 0) {
      setSettingsError('Select at least one supported courier.');
      return;
    }

    const defaultCourier = normalizedSupportedCouriers.includes(rulesDraft.defaultCourier)
      ? rulesDraft.defaultCourier
      : normalizedSupportedCouriers[0];

    try {
      await saveShippingRulesMutation.mutateAsync({
        ...rulesDraft,
        defaultCourier,
        supportedCouriers: normalizedSupportedCouriers,
      });
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Unable to update shipping settings');
    }
  };

  const handleToggleSupportedCourier = (courier: StoreCourier, enabled: boolean) => {
    updateRulesDraft((currentRules) => {
      const supportedCouriers = enabled
        ? [...currentRules.supportedCouriers, courier]
        : currentRules.supportedCouriers.filter((value) => value !== courier);
      const deduplicated = supportedCouriers.filter((value, index, list) => list.indexOf(value) === index);

      return {
        ...currentRules,
        supportedCouriers: deduplicated,
        defaultCourier: deduplicated.includes(currentRules.defaultCourier) ? currentRules.defaultCourier : deduplicated[0] ?? 'nepal-post',
      };
    });
  };

  const handleCreateShipment = async (orderId: string) => {
    try {
      await createShipmentMutation.mutateAsync({
        orderId,
        courier: selectedCourierByOrderId[orderId] ?? rulesDraft?.defaultCourier,
      });
    } catch {
      // Error is surfaced in query/mutation error areas.
    }
  };

  const handleShipmentStatusUpdate = async (orderId: string, status: ShipmentStatus) => {
    try {
      await updateShipmentStatusMutation.mutateAsync({ orderId, status });
    } catch {
      // Error is surfaced in query/mutation error areas.
    }
  };

  const handleCodStatusUpdate = async (orderId: string, status: OrderCodStatus, orderTotal: number) => {
    try {
      await updateCodTrackingMutation.mutateAsync({
        orderId,
        codStatus: status,
        collectedAmount: status === 'collected' ? orderTotal : status === 'failed' ? 0 : undefined,
      });
    } catch {
      // Error is surfaced in query/mutation error areas.
    }
  };

  const handleCourierQuote = async () => {
    setQuoteError(null);
    const destination = quoteDestination.trim();
    const weightKg = Number(quoteWeight.trim() || '0');

    if (destination.length < 3) {
      setQuoteError('Enter destination to fetch courier quotes.');
      return;
    }

    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      setQuoteError('Enter a valid package weight.');
      return;
    }

    try {
      await courierQuoteMutation.mutateAsync({ destination, weightKg });
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : 'Unable to fetch courier quotes');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Shipping & Fulfillment</h1>
        <p className="text-sm text-muted-foreground">
          Configure shipping rules, generate courier labels, track delivery, and manage COD collection.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipping Rules</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set base shipping charges, free-shipping threshold, COD fee, and enabled couriers.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {shippingRulesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading shipping settings...</p> : null}
          {shippingRulesQuery.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                {shippingRulesQuery.error instanceof Error ? shippingRulesQuery.error.message : 'Request failed'}
              </p>
              <Button type="button" variant="outline" onClick={() => void shippingRulesQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}

          {!shippingRulesQuery.isLoading && !shippingRulesQuery.isError && rulesDraft ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <label htmlFor="shipping-base-fee" className="text-xs font-medium text-muted-foreground">Base fee</label>
                  <Input
                    id="shipping-base-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={String(rulesDraft.baseFee)}
                    onChange={(event) =>
                      updateRulesDraft((currentRules) => ({
                        ...currentRules,
                        baseFee: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="shipping-free-above" className="text-xs font-medium text-muted-foreground">Free above</label>
                  <Input
                    id="shipping-free-above"
                    type="number"
                    min="0"
                    step="0.01"
                    value={String(rulesDraft.freeShippingAbove)}
                    onChange={(event) =>
                      updateRulesDraft((currentRules) => ({
                        ...currentRules,
                        freeShippingAbove: Number(event.target.value || 0),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="shipping-cod-fee" className="text-xs font-medium text-muted-foreground">COD fee</label>
                  <Input
                    id="shipping-cod-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={String(rulesDraft.codFee)}
                    onChange={(event) =>
                      updateRulesDraft((currentRules) => ({
                        ...currentRules,
                        codFee: Number(event.target.value || 0),
                      }))
                    }
                    disabled={!rulesDraft.codEnabled}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="shipping-default-courier" className="text-xs font-medium text-muted-foreground">Default courier</label>
                  <select
                    id="shipping-default-courier"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={rulesDraft.defaultCourier}
                    onChange={(event) =>
                      updateRulesDraft((currentRules) => ({
                        ...currentRules,
                        defaultCourier: event.target.value as StoreCourier,
                      }))
                    }
                  >
                    {rulesDraft.supportedCouriers.map((courier) => (
                      <option key={courier} value={courier}>
                        {formatCourierLabel(courier)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 rounded-md border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rulesDraft.codEnabled}
                    onChange={(event) =>
                      updateRulesDraft((currentRules) => ({
                        ...currentRules,
                        codEnabled: event.target.checked,
                      }))
                    }
                  />
                  COD enabled
                </label>
                <div className="text-sm text-muted-foreground">Supported couriers:</div>
                {STORE_COURIER_VALUES.map((courier) => (
                  <label key={courier} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rulesDraft.supportedCouriers.includes(courier)}
                      onChange={(event) => handleToggleSupportedCourier(courier, event.target.checked)}
                    />
                    {formatCourierLabel(courier)}
                  </label>
                ))}
              </div>

              {settingsError ? <p className="text-sm text-destructive">{settingsError}</p> : null}
              {settingsFeedback ? <p className="text-sm text-emerald-700">{settingsFeedback}</p> : null}

              <Button
                type="button"
                onClick={() => void handleSaveShippingRules()}
                disabled={saveShippingRulesMutation.isPending}
              >
                {saveShippingRulesMutation.isPending ? 'Saving...' : 'Save Shipping Rules'}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Courier Integration (Dummy)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fetch local courier quotes using destination and package weight.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            <Input
              placeholder="Destination (e.g. Kathmandu)"
              value={quoteDestination}
              onChange={(event) => setQuoteDestination(event.target.value)}
            />
            <Input
              type="number"
              min="0.1"
              step="0.1"
              placeholder="Weight (kg)"
              value={quoteWeight}
              onChange={(event) => setQuoteWeight(event.target.value)}
            />
            <Button type="button" onClick={() => void handleCourierQuote()} disabled={courierQuoteMutation.isPending}>
              {courierQuoteMutation.isPending ? 'Fetching...' : 'Get Quotes'}
            </Button>
          </div>

          {quoteError ? <p className="text-sm text-destructive">{quoteError}</p> : null}

          {courierQuoteMutation.data && courierQuoteMutation.data.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {courierQuoteMutation.data.map((quote) => (
                <div key={`${quote.courier}-${quote.destination}`} className="rounded-md border p-3 text-sm">
                  <p className="font-medium text-foreground">{formatCourierLabel(quote.courier)}</p>
                  <p className="text-muted-foreground">Destination: {quote.destination}</p>
                  <p className="text-muted-foreground">Fee: {formatCurrency(quote.estimatedFee)}</p>
                  <p className="text-muted-foreground">ETA: {quote.estimatedDays} days</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fulfillment Orders</CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate labels, update shipment status, and track COD collection.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {fulfillmentOrdersQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading fulfillment orders...</p> : null}
          {fulfillmentOrdersQuery.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                {fulfillmentOrdersQuery.error instanceof Error ? fulfillmentOrdersQuery.error.message : 'Request failed'}
              </p>
              <Button type="button" variant="outline" onClick={() => void fulfillmentOrdersQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}

          {!fulfillmentOrdersQuery.isLoading && !fulfillmentOrdersQuery.isError && fulfillmentOrdersQuery.data ? (
            <>
              {fulfillmentOrdersQuery.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders available for fulfillment yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] table-auto border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="px-2 py-2 font-medium">Order</th>
                        <th className="px-2 py-2 font-medium">Customer</th>
                        <th className="px-2 py-2 font-medium">Amount</th>
                        <th className="px-2 py-2 font-medium">Payment</th>
                        <th className="px-2 py-2 font-medium">Shipment</th>
                        <th className="px-2 py-2 font-medium">COD</th>
                        <th className="px-2 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fulfillmentOrdersQuery.data.map((order) => {
                        const hasShipment = Boolean(order.shipment?.trackingNumber);
                        const selectedCourier = selectedCourierByOrderId[order.id] ?? rulesDraft?.defaultCourier ?? 'nepal-post';
                        const availableCouriers = courierOptionIds.filter((courier) =>
                          rulesDraft?.supportedCouriers.includes(courier) ?? true,
                        );

                        return (
                          <tr key={order.id} className="border-b align-top">
                            <td className="px-2 py-3">
                              <p className="font-medium">#{order.orderNumber}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                            </td>
                            <td className="px-2 py-3">
                              <p className="font-medium">{order.customerName}</p>
                              <p className="text-xs text-muted-foreground">{order.customerPhone || 'No phone'}</p>
                              <p className="text-xs text-muted-foreground">{order.customerLocation || 'No address'}</p>
                            </td>
                            <td className="px-2 py-3">
                              <p className="font-medium">{formatCurrency(order.total)}</p>
                              <p className="text-xs text-muted-foreground">
                                Shipping: {formatCurrency(order.shippingFee)} | COD: {formatCurrency(order.codFee)}
                              </p>
                            </td>
                            <td className="px-2 py-3 space-y-1">
                              <p className="text-xs">{order.paymentMethod.toUpperCase()}</p>
                              <Badge variant={paymentBadgeVariant(order.paymentStatus)}>{order.paymentStatus}</Badge>
                              {order.paymentReference ? (
                                <p className="text-xs text-muted-foreground">{order.paymentReference}</p>
                              ) : null}
                            </td>
                            <td className="px-2 py-3 space-y-1">
                              {order.shipment ? (
                                <>
                                  <Badge variant={shipmentBadgeVariant(order.shipment.status)}>
                                    {formatShipmentStatus(order.shipment.status)}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground">{formatCourierLabel(order.shipment.courier)}</p>
                                  <p className="text-xs text-muted-foreground">{order.shipment.trackingNumber || 'No tracking yet'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Updated: {formatDate(order.shipment.lastUpdatedAt)}
                                  </p>
                                  {order.shipment.labelUrl ? (
                                    <a
                                      href={order.shipment.labelUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-block text-xs font-medium text-sky-700 underline"
                                    >
                                      Open label
                                    </a>
                                  ) : null}
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground">Pending label generation</p>
                              )}
                            </td>
                            <td className="px-2 py-3 space-y-1">
                              {order.paymentMethod === 'cod' ? (
                                <>
                                  <Badge variant={codBadgeVariant(order.codStatus)}>{order.codStatus}</Badge>
                                  <p className="text-xs text-muted-foreground">
                                    Collected: {formatCurrency(order.codCollectedAmount)}
                                  </p>
                                </>
                              ) : (
                                <Badge variant="muted">N/A</Badge>
                              )}
                            </td>
                            <td className="px-2 py-3 space-y-2">
                              {!hasShipment ? (
                                <>
                                  <select
                                    value={selectedCourier}
                                    onChange={(event) =>
                                      setSelectedCourierByOrderId((current) => ({
                                        ...current,
                                        [order.id]: event.target.value as StoreCourier,
                                      }))
                                    }
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                  >
                                    {(availableCouriers.length > 0 ? availableCouriers : [selectedCourier]).map((courier) => (
                                      <option key={courier} value={courier}>
                                        {formatCourierLabel(courier)}
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={creatingShipmentOrderId === order.id}
                                    onClick={() => void handleCreateShipment(order.id)}
                                  >
                                    {creatingShipmentOrderId === order.id ? 'Generating...' : 'Generate label'}
                                  </Button>
                                </>
                              ) : (
                                <select
                                  value={order.shipment?.status ?? 'pending'}
                                  onChange={(event) =>
                                    void handleShipmentStatusUpdate(order.id, event.target.value as ShipmentStatus)
                                  }
                                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                  disabled={updatingShipmentOrderId === order.id}
                                >
                                  {SHIPMENT_STATUS_VALUES.map((status) => (
                                    <option key={status} value={status}>
                                      {formatShipmentStatus(status)}
                                    </option>
                                  ))}
                                </select>
                              )}

                              {order.paymentMethod === 'cod' ? (
                                <select
                                  value={order.codStatus}
                                  onChange={(event) =>
                                    void handleCodStatusUpdate(
                                      order.id,
                                      event.target.value as OrderCodStatus,
                                      order.total,
                                    )
                                  }
                                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                  disabled={updatingCodOrderId === order.id}
                                >
                                  {ORDER_COD_STATUS_VALUES.filter((status) => status !== 'not_applicable').map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}

          {createShipmentMutation.isError ? (
            <p className="text-sm text-destructive">
              {createShipmentMutation.error instanceof Error
                ? createShipmentMutation.error.message
                : 'Unable to create shipment'}
            </p>
          ) : null}
          {updateShipmentStatusMutation.isError ? (
            <p className="text-sm text-destructive">
              {updateShipmentStatusMutation.error instanceof Error
                ? updateShipmentStatusMutation.error.message
                : 'Unable to update shipment status'}
            </p>
          ) : null}
          {updateCodTrackingMutation.isError ? (
            <p className="text-sm text-destructive">
              {updateCodTrackingMutation.error instanceof Error
                ? updateCodTrackingMutation.error.message
                : 'Unable to update COD status'}
            </p>
          ) : null}
          {couriersQuery.isError ? (
            <p className="text-sm text-destructive">
              {couriersQuery.error instanceof Error ? couriersQuery.error.message : 'Unable to load courier options'}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
