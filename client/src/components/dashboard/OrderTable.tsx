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

type OrderTableProps = {
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

export default function OrderTable({
  orders,
  updatingOrderId,
  onViewOrder,
  onStatusChange,
}: OrderTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Update Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const isUpdating = updatingOrderId === order.id;

          return (
            <TableRow key={order.id}>
              <TableCell>
                <p className="font-medium text-foreground">#{order.orderNumber}</p>
                <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
              </TableCell>
              <TableCell>
                <p className="font-medium text-foreground">{order.customerName}</p>
                <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
              </TableCell>
              <TableCell className="font-medium">{formatCurrency(order.total)}</TableCell>
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
