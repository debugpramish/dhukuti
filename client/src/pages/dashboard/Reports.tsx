import { type ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  exportReport,
  getCustomerReport,
  getInventoryValuationReport,
  getProductPerformanceReport,
  getSalesReport,
  getTaxReport,
} from '@/services/api/reportsApi';
import type {
  CustomerReport,
  DashboardReportPayload,
  InventoryValuationReport,
  ProductPerformanceReport,
  ReportDateFilters,
  ReportExportFormat,
  ReportType,
  SalesReport,
  TaxReport,
} from '@/services/api/types';

const reportOptions: Array<{ type: ReportType; label: string }> = [
  { type: 'sales', label: 'Sales report' },
  { type: 'tax', label: 'Tax report' },
  { type: 'product-performance', label: 'Product performance' },
  { type: 'inventory-valuation', label: 'Inventory valuation' },
  { type: 'customers', label: 'Customer report' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatStatus(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isDateFilterEnabled(reportType: ReportType): boolean {
  return reportType !== 'inventory-valuation';
}

function renderSalesReport(report: SalesReport) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Net Sales</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(report.summary.netSales)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gross Sales</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(report.summary.grossSales)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Discount Total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(report.summary.discountTotal)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Order Value</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(report.summary.averageOrderValue)}</CardContent>
        </Card>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <TableRow key={`${row.orderNumber}-${row.createdAt}`}>
                <TableCell className="font-medium">#{row.orderNumber}</TableCell>
                <TableCell>{formatDate(row.createdAt)}</TableCell>
                <TableCell>{row.customerName}</TableCell>
                <TableCell>{row.customerEmail}</TableCell>
                <TableCell>
                  <Badge variant={row.status === 'cancelled' ? 'destructive' : 'success'}>{formatStatus(row.status)}</Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(row.subtotal)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.discountTotal)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function renderTaxReport(report: TaxReport) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Taxable Sales</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(report.summary.taxableSales)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Estimated Tax</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(report.summary.estimatedTaxTotal)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gross With Tax</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(report.summary.grossWithTax)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tax Rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{report.summary.taxRatePercent}%</CardContent>
        </Card>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Taxable Amount</TableHead>
              <TableHead className="text-right">Tax Rate</TableHead>
              <TableHead className="text-right">Estimated Tax</TableHead>
              <TableHead className="text-right">Total With Tax</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <TableRow key={`${row.orderNumber}-${row.createdAt}`}>
                <TableCell className="font-medium">#{row.orderNumber}</TableCell>
                <TableCell>{formatDate(row.createdAt)}</TableCell>
                <TableCell>{row.customerName}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.taxableAmount)}</TableCell>
                <TableCell className="text-right">{row.taxRatePercent}%</TableCell>
                <TableCell className="text-right">{formatCurrency(row.estimatedTax)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.totalWithTax)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function renderProductPerformanceReport(report: ProductPerformanceReport) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Products Sold</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{report.summary.uniqueProducts}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Units Sold</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{report.summary.totalUnitsSold}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(report.summary.totalRevenue)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg / Product</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(report.summary.averageRevenuePerProduct)}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead className="text-right">Units Sold</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Avg Unit Price</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <TableRow key={`${row.productTitle}-${row.sku}`}>
                <TableCell className="font-medium">{row.productTitle}</TableCell>
                <TableCell>{row.sku}</TableCell>
                <TableCell>{row.variantName}</TableCell>
                <TableCell className="text-right">{row.unitsSold}</TableCell>
                <TableCell className="text-right">{row.orderCount}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.averageUnitPrice)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function renderInventoryValuationReport(report: InventoryValuationReport) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Inventory Value</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(report.summary.totalInventoryValue)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Units</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{report.summary.totalUnitsInStock}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tracked SKUs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{report.summary.skuCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Low Stock SKUs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{report.summary.lowStockSkuCount}</CardContent>
        </Card>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Threshold</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Valuation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <TableRow key={`${row.productTitle}-${row.sku}`}>
                <TableCell className="font-medium">{row.productTitle}</TableCell>
                <TableCell>{row.sku}</TableCell>
                <TableCell>{row.variantName || 'Default'}</TableCell>
                <TableCell>
                  <Badge variant={row.productStatus === 'active' ? 'success' : 'muted'}>
                    {formatStatus(row.productStatus)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{row.stock}</TableCell>
                <TableCell className="text-right">{row.lowStockThreshold}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.unitPrice)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.valuation)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function renderCustomerReport(report: CustomerReport) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Customers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{report.summary.customerCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Customers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{report.summary.activeCustomers}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Returning Customers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{report.summary.returningCustomers}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{report.summary.totalOrders}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(report.summary.totalRevenue)}</CardContent>
        </Card>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Avg Order</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
              <TableHead>Last Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <TableRow key={row.customerEmail}>
                <TableCell className="font-medium">{row.customerName}</TableCell>
                <TableCell>{row.customerEmail}</TableCell>
                <TableCell>{row.customerPhone || '-'}</TableCell>
                <TableCell>{row.customerLocation || '-'}</TableCell>
                <TableCell className="text-right">{row.ordersCount}</TableCell>
                <TableCell className="text-right">{row.itemsPurchased}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.averageOrderValue)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.totalSpent)}</TableCell>
                <TableCell>{formatDate(row.lastOrderAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('sales');
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState<string | undefined>(undefined);
  const [appliedDateTo, setAppliedDateTo] = useState<string | undefined>(undefined);

  const filters = useMemo<ReportDateFilters>(() => {
    if (!isDateFilterEnabled(activeReport)) {
      return {};
    }

    return {
      dateFrom: appliedDateFrom,
      dateTo: appliedDateTo,
    };
  }, [activeReport, appliedDateFrom, appliedDateTo]);

  const reportQuery = useQuery<DashboardReportPayload>({
    queryKey: ['dashboard-reports', activeReport, filters.dateFrom ?? '', filters.dateTo ?? ''],
    queryFn: async () => {
      switch (activeReport) {
        case 'sales':
          return getSalesReport(filters);
        case 'tax':
          return getTaxReport(filters);
        case 'product-performance':
          return getProductPerformanceReport(filters);
        case 'inventory-valuation':
          return getInventoryValuationReport();
        case 'customers':
          return getCustomerReport(filters);
        default:
          return getSalesReport(filters);
      }
    },
    retry: 1,
  });

  const exportMutation = useMutation({
    mutationFn: ({ format }: { format: ReportExportFormat }) => exportReport(activeReport, format, filters),
  });

  const applyDateFilter = () => {
    setAppliedDateFrom(dateFromInput.trim() || undefined);
    setAppliedDateTo(dateToInput.trim() || undefined);
  };

  const clearDateFilter = () => {
    setDateFromInput('');
    setDateToInput('');
    setAppliedDateFrom(undefined);
    setAppliedDateTo(undefined);
  };

  let reportContent: ReactNode = null;

  if (reportQuery.data) {
    switch (reportQuery.data.reportType) {
      case 'sales':
        reportContent = renderSalesReport(reportQuery.data);
        break;
      case 'tax':
        reportContent = renderTaxReport(reportQuery.data);
        break;
      case 'product-performance':
        reportContent = renderProductPerformanceReport(reportQuery.data);
        break;
      case 'inventory-valuation':
        reportContent = renderInventoryValuationReport(reportQuery.data);
        break;
      case 'customers':
        reportContent = renderCustomerReport(reportQuery.data);
        break;
      default:
        reportContent = null;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Export-ready sales, tax, product performance, inventory valuation, and customer reports.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {reportOptions.map((option) => (
              <Button
                key={option.type}
                type="button"
                size="sm"
                variant={activeReport === option.type ? 'default' : 'outline'}
                onClick={() => setActiveReport(option.type)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {isDateFilterEnabled(activeReport) ? (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">From</p>
                  <Input type="date" value={dateFromInput} onChange={(event) => setDateFromInput(event.target.value)} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">To</p>
                  <Input type="date" value={dateToInput} onChange={(event) => setDateToInput(event.target.value)} />
                </div>
                <Button type="button" variant="outline" onClick={applyDateFilter}>
                  Apply Filter
                </Button>
                <Button type="button" variant="ghost" onClick={clearDateFilter}>
                  Clear
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Inventory valuation is a live snapshot and does not use date filters.</p>
            )}

            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => exportMutation.mutate({ format: 'csv' })}
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? 'Exporting...' : 'Export CSV'}
              </Button>
              <Button
                type="button"
                onClick={() => exportMutation.mutate({ format: 'excel' })}
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? 'Exporting...' : 'Export Excel'}
              </Button>
            </div>
          </div>

          {exportMutation.isError ? (
            <p className="text-sm text-destructive">
              {exportMutation.error instanceof Error ? exportMutation.error.message : 'Unable to export report'}
            </p>
          ) : null}
        </CardHeader>
      </Card>

      {reportQuery.isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading report...</CardContent>
        </Card>
      ) : null}

      {reportQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-destructive">
              {reportQuery.error instanceof Error ? reportQuery.error.message : 'Request failed'}
            </p>
            <Button type="button" variant="outline" onClick={() => void reportQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!reportQuery.isLoading && !reportQuery.isError && reportQuery.data ? reportContent : null}

      {!reportQuery.isLoading && !reportQuery.isError && reportQuery.data && reportQuery.data.rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No rows found for the selected report and filters.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
