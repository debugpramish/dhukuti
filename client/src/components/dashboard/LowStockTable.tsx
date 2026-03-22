import { CheckCircle2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryAlert } from '@/services/api/types';

export type LowStockTableProps = {
  alerts: InventoryAlert[];
};

export default function LowStockTable({ alerts }: LowStockTableProps) {
  if (alerts.length === 0) {
    return (
      <Card className="border-slate-200 shadow-none">
        <CardContent className="px-6 py-10 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          <p className="text-sm font-semibold text-emerald-600">All items are well-stocked</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <Table>
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Product</TableHead>
            <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Variant</TableHead>
            <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current Stock</TableHead>
            <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Threshold</TableHead>
            <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => (
            <TableRow
              key={`${alert.productId}-${alert.variantId}`}
              className={alert.stock <= Math.max(1, alert.lowStockThreshold * 0.3) ? 'border-slate-100 bg-red-50/50 hover:bg-red-50' : 'border-slate-100 bg-amber-50/40 hover:bg-amber-50'}
            >
              <TableCell className="px-6 py-3.5 font-semibold text-slate-900">{alert.productTitle}</TableCell>
              <TableCell className="px-6 py-3.5 text-slate-600">{alert.variantName || 'Default'}</TableCell>
              <TableCell className="px-6 py-3.5 text-right font-semibold tabular-nums text-slate-900">{alert.stock}</TableCell>
              <TableCell className="px-6 py-3.5 text-right tabular-nums text-slate-500">{alert.lowStockThreshold}</TableCell>
              <TableCell className="px-6 py-3.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${alert.stock <= Math.max(1, alert.lowStockThreshold * 0.3)
                      ? 'bg-red-100 text-red-600'
                      : 'bg-amber-100 text-amber-600'
                    }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {alert.stock <= Math.max(1, alert.lowStockThreshold * 0.3) ? 'Critical' : 'Warning'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
