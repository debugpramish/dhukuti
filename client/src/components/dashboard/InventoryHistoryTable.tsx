import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryLog, InventoryReason } from '@/services/api/types';

export type InventoryHistoryTableProps = {
  history: InventoryLog[];
  productTitleById: Record<string, string>;
  variantNameById: Record<string, string>;
};

function formatReason(reason: InventoryReason): string {
  switch (reason) {
    case 'order':
      return 'Order placed';
    case 'manual_adjustment':
      return 'Manual adjustment';
    case 'restock':
      return 'Restock';
    case 'correction':
      return 'Correction';
    default:
      return 'Adjustment';
  }
}

function reasonBadgeVariant(reason: InventoryReason): 'info' | 'success' | 'warning' | 'muted' {
  switch (reason) {
    case 'order':
      return 'info';
    case 'restock':
      return 'success';
    case 'correction':
      return 'warning';
    default:
      return 'muted';
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function InventoryHistoryTable({ history, productTitleById, variantNameById }: InventoryHistoryTableProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No inventory history yet. Adjust stock or place an order to see activity.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Change</TableHead>
            <TableHead className="text-right">Before</TableHead>
            <TableHead className="text-right">After</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((entry) => {
            const productTitle = productTitleById[entry.productId] ?? 'Unknown product';
            const variantName = variantNameById[entry.variantId] ?? 'Default';
            const changeLabel = entry.change > 0 ? `+${entry.change}` : String(entry.change);
            const changeClass =
              entry.change < 0 ? 'text-destructive' : entry.change > 0 ? 'text-emerald-600' : 'text-muted-foreground';

            return (
              <TableRow key={entry.id}>
                <TableCell>{formatDate(entry.createdAt)}</TableCell>
                <TableCell className="font-medium">{productTitle}</TableCell>
                <TableCell>{variantName}</TableCell>
                <TableCell>{entry.sku}</TableCell>
                <TableCell className={`text-right ${changeClass}`}>
                  {changeLabel}
                </TableCell>
                <TableCell className="text-right">{entry.stockBefore}</TableCell>
                <TableCell className="text-right">{entry.stockAfter}</TableCell>
                <TableCell>
                  <Badge variant={reasonBadgeVariant(entry.reason)}>{formatReason(entry.reason)}</Badge>
                </TableCell>
                <TableCell>{entry.note || '-'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
