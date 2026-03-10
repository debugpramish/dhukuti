import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryAlert } from '@/services/api/types';

export type LowStockTableProps = {
  alerts: InventoryAlert[];
};

export default function LowStockTable({ alerts }: LowStockTableProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No low stock alerts. Your inventory levels look healthy.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Threshold</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow key={`${alert.productId}-${alert.variantId}`}>
              <TableCell className="font-medium">{alert.productTitle}</TableCell>
              <TableCell>{alert.variantName || 'Default'}</TableCell>
              <TableCell>{alert.sku}</TableCell>
              <TableCell className="text-right">{alert.stock}</TableCell>
              <TableCell className="text-right">{alert.lowStockThreshold}</TableCell>
              <TableCell>
                <Badge variant={alert.stock <= 0 ? 'destructive' : 'warning'}>
                  {alert.stock <= 0 ? 'Out of stock' : 'Low stock'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
