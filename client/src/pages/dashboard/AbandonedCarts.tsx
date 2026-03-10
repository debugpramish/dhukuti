import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getAbandonedCartAnalytics,
  getAbandonedCarts,
  runAbandonedCartAutoReminders,
  sendAbandonedCartReminder,
} from '@/services/api/abandonedCartApi';
import type { AbandonedCheckout, AbandonedCheckoutStatus } from '@/services/api/types';

type AbandonedStatusFilter = 'open' | 'recovered' | 'all';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string): string {
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

function minutesSince(value: string): number {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (60 * 1000)));
}

function checkoutStatusVariant(status: AbandonedCheckoutStatus): 'warning' | 'success' | 'muted' {
  if (status === 'recovered') {
    return 'success';
  }

  if (status === 'expired') {
    return 'muted';
  }

  return 'warning';
}

function reminderStatusVariant(status: string | undefined): 'info' | 'success' | 'destructive' | 'muted' {
  if (status === 'sent') {
    return 'success';
  }

  if (status === 'failed') {
    return 'destructive';
  }

  if (status === 'simulated') {
    return 'info';
  }

  return 'muted';
}

function formatRecoveryRate(value: number): string {
  return `${Math.max(0, value).toFixed(2)}%`;
}

function countItems(checkout: AbandonedCheckout): number {
  return checkout.items.reduce((sum, item) => sum + item.quantity, 0);
}

export default function AbandonedCartsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<AbandonedStatusFilter>('open');
  const [thresholdInput, setThresholdInput] = useState('30');
  const [thresholdMinutes, setThresholdMinutes] = useState(30);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);

  const cartsQuery = useQuery({
    queryKey: ['abandoned-carts', statusFilter, thresholdMinutes],
    queryFn: () =>
      getAbandonedCarts({
        status: statusFilter,
        thresholdMinutes,
        limit: 100,
      }),
    retry: 1,
  });

  const analyticsQuery = useQuery({
    queryKey: ['abandoned-carts-analytics', thresholdMinutes],
    queryFn: () => getAbandonedCartAnalytics({ thresholdMinutes }),
    retry: 1,
  });

  const sendReminderMutation = useMutation({
    mutationFn: ({ cartId }: { cartId: string }) => sendAbandonedCartReminder(cartId),
    onSuccess: async (result) => {
      setPageSuccess(`Reminder ${result.status}: ${result.message}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['abandoned-carts'] }),
        queryClient.invalidateQueries({ queryKey: ['abandoned-carts-analytics'] }),
      ]);
    },
  });

  const autoReminderMutation = useMutation({
    mutationFn: () =>
      runAbandonedCartAutoReminders({
        thresholdMinutes,
        cooldownMinutes: 240,
        limit: 100,
      }),
    onSuccess: async (result) => {
      setPageSuccess(
        `Auto reminders complete. Scanned ${result.result.scanned}, simulated ${result.result.simulated}, failed ${result.result.failed}.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['abandoned-carts'] }),
        queryClient.invalidateQueries({ queryKey: ['abandoned-carts-analytics'] }),
      ]);
    },
  });

  const carts = cartsQuery.data ?? [];
  const activeThresholdDescription = useMemo(
    () =>
      statusFilter === 'open'
        ? `Showing open checkouts inactive for at least ${thresholdMinutes} minutes.`
        : 'Showing all tracked checkout sessions for this merchant.',
    [statusFilter, thresholdMinutes],
  );

  const applyThreshold = () => {
    setPageError(null);
    const parsed = Number(thresholdInput.trim());

    if (!Number.isFinite(parsed) || parsed < 1) {
      setPageError('Threshold must be at least 1 minute.');
      return;
    }

    setThresholdMinutes(Math.floor(parsed));
  };

  const handleSendReminder = async (cartId: string) => {
    setPageError(null);
    setPageSuccess(null);

    try {
      await sendReminderMutation.mutateAsync({ cartId });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to send reminder');
    }
  };

  const handleRunAutoReminders = async () => {
    setPageError(null);
    setPageSuccess(null);

    try {
      await autoReminderMutation.mutateAsync();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to run auto reminders');
    }
  };

  const reminderLoadingCartId = sendReminderMutation.isPending ? sendReminderMutation.variables?.cartId : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Abandoned Carts</h1>
        <p className="text-sm text-muted-foreground">
          Track dropped checkouts, auto-send reminders, and monitor recovery performance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Captured</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {analyticsQuery.data ? analyticsQuery.data.totalCaptured : '--'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Abandoned</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {analyticsQuery.data ? analyticsQuery.data.abandonedCount : '--'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recovered</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {analyticsQuery.data ? analyticsQuery.data.recoveredCount : '--'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recovery Rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {analyticsQuery.data ? formatRecoveryRate(analyticsQuery.data.recoveryRatePercent) : '--'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue Recovered</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {analyticsQuery.data ? formatCurrency(analyticsQuery.data.revenueRecovered) : '--'}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recovery Analytics</CardTitle>
          <p className="text-sm text-muted-foreground">
            Potential revenue: {analyticsQuery.data ? formatCurrency(analyticsQuery.data.potentialRevenue) : '--'} | Reminders sent:{' '}
            {analyticsQuery.data ? analyticsQuery.data.remindersSent : '--'} (auto {analyticsQuery.data ? analyticsQuery.data.autoRemindersSent : '--'})
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Checkout Sessions</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AbandonedStatusFilter)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="open">Open (Abandoned)</option>
              <option value="recovered">Recovered</option>
              <option value="all">All</option>
            </select>
            <Input
              type="number"
              min="1"
              value={thresholdInput}
              onChange={(event) => setThresholdInput(event.target.value)}
              className="h-10 w-40"
              placeholder="Threshold mins"
            />
            <Button type="button" variant="outline" onClick={applyThreshold}>
              Apply threshold
            </Button>
            <Button
              type="button"
              onClick={() => void handleRunAutoReminders()}
              disabled={autoReminderMutation.isPending}
            >
              {autoReminderMutation.isPending ? 'Running auto reminders...' : 'Auto-send reminders'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{activeThresholdDescription}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {pageError ? <p className="text-sm text-destructive">{pageError}</p> : null}
          {pageSuccess ? <p className="text-sm text-emerald-700">{pageSuccess}</p> : null}

          {cartsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading abandoned carts...</p> : null}
          {cartsQuery.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                {cartsQuery.error instanceof Error ? cartsQuery.error.message : 'Request failed'}
              </p>
              <Button type="button" variant="outline" onClick={() => void cartsQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}

          {!cartsQuery.isLoading && !cartsQuery.isError && carts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No checkout sessions found for this filter.</p>
          ) : null}

          {!cartsQuery.isLoading && !cartsQuery.isError && carts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] table-auto border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Customer</th>
                    <th className="px-2 py-2 font-medium">Items</th>
                    <th className="px-2 py-2 font-medium">Bill</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Activity</th>
                    <th className="px-2 py-2 font-medium">Reminders</th>
                    <th className="px-2 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {carts.map((cart) => (
                    <tr key={cart.id} className="border-b align-top">
                      <td className="px-2 py-3">
                        <p className="font-medium">{cart.customerName}</p>
                        <p className="text-xs text-muted-foreground">{cart.customerEmail}</p>
                        <p className="text-xs text-muted-foreground">{cart.customerPhone || 'No phone'}</p>
                        <p className="text-xs text-muted-foreground">{cart.customerLocation || 'No location'}</p>
                      </td>
                      <td className="px-2 py-3">
                        <p className="font-medium">{countItems(cart)} items</p>
                        <p className="text-xs text-muted-foreground">
                          {cart.items.slice(0, 2).map((item) => item.title).join(', ')}
                          {cart.items.length > 2 ? ` +${cart.items.length - 2} more` : ''}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <p className="font-medium">{formatCurrency(cart.total)}</p>
                        <p className="text-xs text-muted-foreground">
                          Shipping {formatCurrency(cart.shippingFee)} | COD {formatCurrency(cart.codFee)}
                        </p>
                        <p className="text-xs text-muted-foreground">Method: {cart.paymentMethod.toUpperCase()}</p>
                      </td>
                      <td className="px-2 py-3">
                        <Badge variant={checkoutStatusVariant(cart.status)}>{cart.status}</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">Source: {cart.source.replace('_', ' ')}</p>
                      </td>
                      <td className="px-2 py-3">
                        <p className="text-xs text-muted-foreground">Last activity</p>
                        <p className="font-medium">{formatDateTime(cart.lastActivityAt)}</p>
                        <p className="text-xs text-muted-foreground">{minutesSince(cart.lastActivityAt)} mins ago</p>
                        {cart.recoveredAt ? (
                          <p className="text-xs text-emerald-700">Recovered: {formatDateTime(cart.recoveredAt)}</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">
                        <p className="font-medium">
                          {cart.reminderCount} total ({cart.autoReminderCount} auto)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last: {cart.lastReminderSentAt ? formatDateTime(cart.lastReminderSentAt) : 'Never'}
                        </p>
                        <Badge variant={reminderStatusVariant(cart.lastReminderStatus)}>{cart.lastReminderStatus || 'none'}</Badge>
                      </td>
                      <td className="px-2 py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={cart.status !== 'open' || reminderLoadingCartId === cart.id}
                          onClick={() => void handleSendReminder(cart.id)}
                        >
                          {reminderLoadingCartId === cart.id ? 'Sending...' : 'Send reminder'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
