import { Eye } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ORDER_STATUS_VALUES, type Order, type OrderStatus } from '@/services/api/types';

type CustomerTableProps = {
  orders: Order[];
  updatingOrderId: string | null;
  onViewOrder: (order: Order) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
};

const statusVariantMap: Record<OrderStatus, 'warning' | 'info' | 'secondary' | 'success' | 'destructive'> = {
  pending: 'warning',
  confirmed: 'info',
  shipped: 'secondary',
  delivered: 'success',
  cancelled: 'destructive',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatStatus(status: OrderStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function summarizeItems(order: Order): string {
  const summaryItems = order.items.slice(0, 2).map((item) => `${item.title} x${item.quantity}`);
  const remainingCount = order.items.length - summaryItems.length;

  if (remainingCount > 0) {
    summaryItems.push(`+${remainingCount} more`);
  }

  return summaryItems.join(', ');
}

export default function CustomerTable({
  orders,
  updatingOrderId,
  onViewOrder,
  onStatusChange,
}: CustomerTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Bill</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Update Status</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const isUpdating = updatingOrderId === order.id;

          return (
            <TableRow key={order.id}>
              <TableCell>
                <p className="font-medium text-foreground">{order.customerName}</p>
                <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
              </TableCell>
              <TableCell className="text-sm">{order.customerPhone || 'N/A'}</TableCell>
              <TableCell className="text-sm">{order.customerLocation || 'N/A'}</TableCell>
              <TableCell className="max-w-[260px] text-sm text-muted-foreground">
                {summarizeItems(order)}
              </TableCell>
              <TableCell className="text-sm">
                <p className="font-medium text-foreground">{formatCurrency(order.total)}</p>
                <p className="text-xs text-muted-foreground">
                  Discount: {formatCurrency(order.discountTotal)}
                </p>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariantMap[order.status]}>{formatStatus(order.status)}</Badge>
              </TableCell>
              <TableCell>
                <select
                  value={order.status}
                  onChange={(event) => onStatusChange(order.id, event.target.value as OrderStatus)}
                  disabled={isUpdating}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {ORDER_STATUS_VALUES.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell className="text-right">
                <Button type="button" variant="outline" size="sm" onClick={() => onViewOrder(order)}>
                  <Eye className="h-4 w-4" />
                  View
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

