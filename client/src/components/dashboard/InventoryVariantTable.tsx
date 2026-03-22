import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Product, ProductVariant } from '@/services/api/types';

function rowStatus(variant: ProductVariant): 'Critical' | 'Warning' | 'Healthy' {
  if (variant.stock <= Math.max(1, variant.lowStockThreshold * 0.3)) {
    return 'Critical';
  }

  if (variant.stock <= variant.lowStockThreshold) {
    return 'Warning';
  }

  return 'Healthy';
}

export type InventoryVariantTableProps = {
  products: Product[];
  onCreateVariant: (product: Product) => void;
  onEditVariant: (product: Product, variant: ProductVariant) => void;
  onAdjustStock: (product: Product, variant: ProductVariant) => void;
};

export default function InventoryVariantTable({
  products,
  onCreateVariant,
  onEditVariant,
  onAdjustStock,
}: InventoryVariantTableProps) {
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No products found. Create a product to begin managing inventory variants.
        </CardContent>
      </Card>
    );
  }

  const rows = products.flatMap((product) =>
    product.variants.map((variant) => ({
      product,
      variant,
    })),
  );

  return (
    <Card className="border-slate-200 shadow-none">
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-500">No variants yet. Add a variant to track stock.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <Table>
              <TableHeader className="[&_tr]:border-b-0">
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Product</TableHead>
                  <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Variant</TableHead>
                  <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">SKU</TableHead>
                  <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Stock</TableHead>
                  <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Threshold</TableHead>
                  <TableHead className="h-11 px-6 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</TableHead>
                  <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ product, variant }) => {
                  const status = rowStatus(variant);
                  const statusClassName =
                    status === 'Critical'
                      ? 'bg-red-50 text-red-600'
                      : status === 'Warning'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-emerald-50 text-emerald-600';

                  return (
                    <TableRow key={variant.id} className="border-slate-100 hover:bg-slate-50">
                      <TableCell className="px-6 py-3.5 font-semibold text-slate-900">{product.title}</TableCell>
                      <TableCell className="px-6 py-3.5 text-slate-600">{variant.name || 'Default'}</TableCell>
                      <TableCell className="px-6 py-3.5">
                        <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{variant.sku}</code>
                      </TableCell>
                      <TableCell className="px-6 py-3.5 text-right font-semibold tabular-nums text-slate-900">{variant.stock}</TableCell>
                      <TableCell className="px-6 py-3.5 text-right tabular-nums text-slate-500">{variant.lowStockThreshold}</TableCell>
                      <TableCell className="px-6 py-3.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName}`}>
                          {status}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-3.5 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-md border-slate-200 px-2.5 text-xs font-semibold text-slate-600"
                            onClick={() => onEditVariant(product, variant)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 rounded-md bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            onClick={() => onAdjustStock(product, variant)}
                          >
                            Adjust
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-md px-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                            onClick={() => onCreateVariant(product)}
                          >
                            Add
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
