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
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <Table>
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Date</TableHead>
            <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Product</TableHead>
            <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Variant</TableHead>
            <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Change</TableHead>
            <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Reason</TableHead>
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
              <TableRow key={entry.id} className="border-slate-100 hover:bg-slate-50">
                <TableCell className="px-6 py-3.5 tabular-nums text-slate-500">{formatDate(entry.createdAt)}</TableCell>
                <TableCell className="px-6 py-3.5 font-semibold text-slate-900">{productTitle}</TableCell>
                <TableCell className="px-6 py-3.5 text-slate-600">{variantName}</TableCell>
                <TableCell className={`px-6 py-3.5 text-right font-semibold tabular-nums ${changeClass}`}>{changeLabel}</TableCell>
                <TableCell className="px-6 py-3.5">
                  <Badge variant={reasonBadgeVariant(entry.reason)}>{formatReason(entry.reason)}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
