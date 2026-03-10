import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getCustomerAnalytics, getProductAnalytics, getSalesAnalytics } from '@/services/api/analyticsApi';

type AnalyticsFilters = {
  dateFrom?: string;
  dateTo?: string;
  limit: number;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function AnalyticsPage() {
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [filterError, setFilterError] = useState<string | null>(null);

  const filters = useMemo<AnalyticsFilters>(
    () => ({
      dateFrom,
      dateTo,
      limit: 20,
    }),
    [dateFrom, dateTo],
  );

  const salesQuery = useQuery({
    queryKey: ['analytics-sales', filters],
    queryFn: () => getSalesAnalytics(filters),
    retry: 1,
  });

  const customerQuery = useQuery({
    queryKey: ['analytics-customers', filters],
    queryFn: () => getCustomerAnalytics(filters),
    retry: 1,
  });

  const productQuery = useQuery({
    queryKey: ['analytics-products', filters],
    queryFn: () => getProductAnalytics(filters),
    retry: 1,
  });

  const applyDateFilter = () => {
    setFilterError(null);
    if (dateFromInput && dateToInput && dateFromInput > dateToInput) {
      setFilterError('Start date must be before or equal to end date.');
      return;
    }

    setDateFrom(dateFromInput || undefined);
    setDateTo(dateToInput || undefined);
  };

  const clearDateFilter = () => {
    setDateFromInput('');
    setDateToInput('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setFilterError(null);
  };

  const salesTrendData = useMemo(
    () =>
      (salesQuery.data?.revenueTrend ?? []).map((point) => ({
        ...point,
        label: formatDateLabel(point.date),
      })),
    [salesQuery.data?.revenueTrend],
  );

  const productRevenueChartData = useMemo(
    () =>
      (salesQuery.data?.revenueByProduct ?? [])
        .slice(0, 8)
        .map((row) => ({
          ...row,
          shortTitle: row.title.length > 20 ? `${row.title.slice(0, 20)}...` : row.title,
        })),
    [salesQuery.data?.revenueByProduct],
  );

  const productConversionChartData = useMemo(
    () =>
      (productQuery.data?.conversion ?? [])
        .slice(0, 8)
        .map((row) => ({
          ...row,
          shortTitle: row.title.length > 20 ? `${row.title.slice(0, 20)}...` : row.title,
        })),
    [productQuery.data?.conversion],
  );

  const geographyChartData = useMemo(
    () =>
      (customerQuery.data?.geography ?? []).slice(0, 8).map((row) => ({
        ...row,
        shortLocation: row.location.length > 18 ? `${row.location.slice(0, 18)}...` : row.location,
      })),
    [customerQuery.data?.geography],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Sales, customer, and product performance insights from real storefront and order data.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Date Filter</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="analytics-date-from">From</label>
              <Input
                id="analytics-date-from"
                type="date"
                value={dateFromInput}
                onChange={(event) => setDateFromInput(event.target.value)}
                className="h-10 w-44"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="analytics-date-to">To</label>
              <Input
                id="analytics-date-to"
                type="date"
                value={dateToInput}
                onChange={(event) => setDateToInput(event.target.value)}
                className="h-10 w-44"
              />
            </div>
            <Button type="button" onClick={applyDateFilter}>Apply</Button>
            <Button type="button" variant="outline" onClick={clearDateFilter}>Clear</Button>
          </div>
          {filterError ? <p className="text-sm text-destructive">{filterError}</p> : null}
        </CardHeader>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Sales Analytics</h2>
          <p className="text-sm text-muted-foreground">Revenue trends, product/category breakdown, and traffic attribution.</p>
        </div>

        {salesQuery.isLoading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Loading sales analytics...</CardContent>
          </Card>
        ) : null}
        {salesQuery.isError ? (
          <Card>
            <CardContent className="space-y-2 py-8">
              <p className="text-sm text-destructive">
                {salesQuery.error instanceof Error ? salesQuery.error.message : 'Unable to load sales analytics'}
              </p>
              <Button type="button" variant="outline" onClick={() => void salesQuery.refetch()}>Retry</Button>
            </CardContent>
          </Card>
        ) : null}
        {!salesQuery.isLoading && !salesQuery.isError && salesQuery.data ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Total Revenue</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{formatCurrency(salesQuery.data.summary.totalRevenue)}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Total Orders</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{salesQuery.data.summary.totalOrders}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Units Sold</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{salesQuery.data.summary.totalUnitsSold}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Avg Order Value</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{formatCurrency(salesQuery.data.summary.averageOrderValue)}</CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Product</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={productRevenueChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="shortTitle" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                        <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Revenue by Category</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[520px] table-auto border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="px-2 py-2">Category</th>
                        <th className="px-2 py-2">Revenue</th>
                        <th className="px-2 py-2">Units</th>
                        <th className="px-2 py-2">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesQuery.data.revenueByCategory.map((row) => (
                        <tr key={row.category} className="border-b">
                          <td className="px-2 py-2 font-medium">{row.category}</td>
                          <td className="px-2 py-2">{formatCurrency(row.revenue)}</td>
                          <td className="px-2 py-2">{row.unitsSold}</td>
                          <td className="px-2 py-2">{row.ordersCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Revenue by Traffic Source</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[520px] table-auto border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="px-2 py-2">Source</th>
                        <th className="px-2 py-2">Revenue</th>
                        <th className="px-2 py-2">Orders</th>
                        <th className="px-2 py-2">AOV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesQuery.data.revenueByTrafficSource.map((row) => (
                        <tr key={row.source} className="border-b">
                          <td className="px-2 py-2 font-medium">{row.source}</td>
                          <td className="px-2 py-2">{formatCurrency(row.revenue)}</td>
                          <td className="px-2 py-2">{row.ordersCount}</td>
                          <td className="px-2 py-2">{formatCurrency(row.averageOrderValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Customer Analytics</h2>
          <p className="text-sm text-muted-foreground">New vs returning customers, LTV, cohorts, and geography.</p>
        </div>

        {customerQuery.isLoading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Loading customer analytics...</CardContent>
          </Card>
        ) : null}
        {customerQuery.isError ? (
          <Card>
            <CardContent className="space-y-2 py-8">
              <p className="text-sm text-destructive">
                {customerQuery.error instanceof Error ? customerQuery.error.message : 'Unable to load customer analytics'}
              </p>
              <Button type="button" variant="outline" onClick={() => void customerQuery.refetch()}>Retry</Button>
            </CardContent>
          </Card>
        ) : null}
        {!customerQuery.isLoading && !customerQuery.isError && customerQuery.data ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Active Customers</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{customerQuery.data.summary.activeCustomers}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">New Customers</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{customerQuery.data.summary.newCustomers}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Returning Customers</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{customerQuery.data.summary.returningCustomers}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Average LTV</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{formatCurrency(customerQuery.data.summary.averageLtv)}</CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Top Customer LTV</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[620px] table-auto border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="px-2 py-2">Customer</th>
                        <th className="px-2 py-2">Orders</th>
                        <th className="px-2 py-2">Total Spent</th>
                        <th className="px-2 py-2">AOV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerQuery.data.ltv.slice(0, 10).map((row) => (
                        <tr key={row.customerKey} className="border-b">
                          <td className="px-2 py-2">
                            <p className="font-medium">{row.customerName}</p>
                            <p className="text-xs text-muted-foreground">{row.customerEmail}</p>
                          </td>
                          <td className="px-2 py-2">{row.ordersCount}</td>
                          <td className="px-2 py-2">{formatCurrency(row.totalSpent)}</td>
                          <td className="px-2 py-2">{formatCurrency(row.averageOrderValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Geographic Map (Distribution)</CardTitle></CardHeader>
                <CardContent className="space-y-3 overflow-x-auto">
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={geographyChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="shortLocation" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                        <Bar dataKey="revenue" fill="hsl(var(--chart-5))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <table className="w-full min-w-[520px] table-auto border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="px-2 py-2">Location</th>
                        <th className="px-2 py-2">Customers</th>
                        <th className="px-2 py-2">Orders</th>
                        <th className="px-2 py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerQuery.data.geography.map((row) => (
                        <tr key={row.location} className="border-b">
                          <td className="px-2 py-2 font-medium">{row.location}</td>
                          <td className="px-2 py-2">{row.customers}</td>
                          <td className="px-2 py-2">{row.orders}</td>
                          <td className="px-2 py-2">{formatCurrency(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Cohort Retention</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[900px] table-auto border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="px-2 py-2">Cohort</th>
                      <th className="px-2 py-2">Size</th>
                      <th className="px-2 py-2">M0</th>
                      <th className="px-2 py-2">M1</th>
                      <th className="px-2 py-2">M2</th>
                      <th className="px-2 py-2">M3</th>
                      <th className="px-2 py-2">M4</th>
                      <th className="px-2 py-2">M5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerQuery.data.cohorts.map((row) => (
                      <tr key={row.cohort} className="border-b">
                        <td className="px-2 py-2 font-medium">{row.label}</td>
                        <td className="px-2 py-2">{row.size}</td>
                        {row.retention.map((point) => (
                          <td key={`${row.cohort}-${point.monthOffset}`} className="px-2 py-2">
                            {formatPercent(point.ratePercent)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Product Performance</h2>
          <p className="text-sm text-muted-foreground">
            Conversion by product, view-to-purchase ratio, and estimated profit by SKU.
          </p>
        </div>

        {productQuery.isLoading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Loading product analytics...</CardContent>
          </Card>
        ) : null}
        {productQuery.isError ? (
          <Card>
            <CardContent className="space-y-2 py-8">
              <p className="text-sm text-destructive">
                {productQuery.error instanceof Error ? productQuery.error.message : 'Unable to load product analytics'}
              </p>
              <Button type="button" variant="outline" onClick={() => void productQuery.refetch()}>Retry</Button>
            </CardContent>
          </Card>
        ) : null}
        {!productQuery.isLoading && !productQuery.isError && productQuery.data ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Tracked Products</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{productQuery.data.summary.trackedProducts}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">View Events</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{productQuery.data.summary.viewEvents}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Conversion</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{formatPercent(productQuery.data.summary.conversionRatePercent)}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Estimated Profit</CardTitle></CardHeader>
                <CardContent className="text-2xl font-semibold">{formatCurrency(productQuery.data.summary.totalEstimatedProfit)}</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Views vs Purchases by Product</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productConversionChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="shortTitle" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="viewEvents" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="purchaseOrders" fill="hsl(var(--chart-4))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Conversion per Product</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[760px] table-auto border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="px-2 py-2">Product</th>
                        <th className="px-2 py-2">Views</th>
                        <th className="px-2 py-2">Purchases</th>
                        <th className="px-2 py-2">View:Purchase</th>
                        <th className="px-2 py-2">Conversion</th>
                        <th className="px-2 py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productQuery.data.conversion.map((row) => (
                        <tr key={row.productId} className="border-b">
                          <td className="px-2 py-2">
                            <p className="font-medium">{row.title}</p>
                            <p className="text-xs text-muted-foreground">{row.category}</p>
                          </td>
                          <td className="px-2 py-2">{row.viewEvents}</td>
                          <td className="px-2 py-2">{row.purchaseOrders}</td>
                          <td className="px-2 py-2">
                            {row.purchaseOrders > 0 ? `${row.viewToPurchaseRatio.toFixed(2)} : 1` : '-'}
                          </td>
                          <td className="px-2 py-2">{formatPercent(row.conversionRatePercent)}</td>
                          <td className="px-2 py-2">{formatCurrency(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Profit per SKU</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 overflow-x-auto">
                  <p className="text-xs text-muted-foreground">
                    Estimated using default cost ratio {productQuery.data.summary.defaultCostRatioPercent}%.
                  </p>
                  <table className="w-full min-w-[760px] table-auto border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="px-2 py-2">SKU</th>
                        <th className="px-2 py-2">Product</th>
                        <th className="px-2 py-2">Units</th>
                        <th className="px-2 py-2">Revenue</th>
                        <th className="px-2 py-2">Cost</th>
                        <th className="px-2 py-2">Profit</th>
                        <th className="px-2 py-2">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productQuery.data.profitBySku.map((row) => (
                        <tr key={`${row.sku}-${row.title}`} className="border-b">
                          <td className="px-2 py-2 font-medium">{row.sku}</td>
                          <td className="px-2 py-2">
                            <p>{row.title}</p>
                            <p className="text-xs text-muted-foreground">{row.category}</p>
                          </td>
                          <td className="px-2 py-2">{row.unitsSold}</td>
                          <td className="px-2 py-2">{formatCurrency(row.revenue)}</td>
                          <td className="px-2 py-2">{formatCurrency(row.estimatedCost)}</td>
                          <td className="px-2 py-2">{formatCurrency(row.estimatedProfit)}</td>
                          <td className="px-2 py-2">{formatPercent(row.profitMarginPercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
