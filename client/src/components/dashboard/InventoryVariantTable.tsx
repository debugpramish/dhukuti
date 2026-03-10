import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Product, ProductVariant } from '@/services/api/types';

const lowStockLabel = 'Low stock';

function formatStockLabel(variant: ProductVariant): string {
  if (variant.stock <= 0) {
    return 'Out of stock';
  }

  if (variant.stock <= variant.lowStockThreshold) {
    return lowStockLabel;
  }

  return 'Healthy';
}

function stockBadgeVariant(variant: ProductVariant): 'destructive' | 'warning' | 'success' {
  if (variant.stock <= 0) {
    return 'destructive';
  }

  if (variant.stock <= variant.lowStockThreshold) {
    return 'warning';
  }

  return 'success';
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

  return (
    <div className="space-y-4">
      {products.map((product) => (
        <Card key={product.id}>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">{product.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{product.variants.length} variant(s)</p>
            </div>
            <Button type="button" size="sm" onClick={() => onCreateVariant(product)}>
              Add Variant
            </Button>
          </CardHeader>
          <CardContent>
            {product.variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No variants yet. Add a variant to track stock.</p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Low stock threshold</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell className="font-medium">{variant.sku}</TableCell>
                        <TableCell>{variant.name || 'Default'}</TableCell>
                        <TableCell className="text-right">{variant.stock}</TableCell>
                        <TableCell className="text-right">{variant.lowStockThreshold}</TableCell>
                        <TableCell>
                          <Badge variant={stockBadgeVariant(variant)}>{formatStockLabel(variant)}</Badge>
                        </TableCell>
                        <TableCell>
                          {variant.isDefault ? <Badge variant="info">Default</Badge> : <Badge variant="muted">No</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => onEditVariant(product, variant)}>
                              Edit
                            </Button>
                            <Button type="button" size="sm" variant="secondary" onClick={() => onAdjustStock(product, variant)}>
                              Adjust
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
