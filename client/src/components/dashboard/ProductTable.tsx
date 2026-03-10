import { PencilLine, Trash2 } from 'lucide-react';

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
import { buildProductPlaceholderImage } from '@/lib/image';
import type { Product, ProductStatus } from '@/services/api/types';

type ProductFlagKey = 'isFeatured' | 'isTrending' | 'isBestSeller';

type ProductTableProps = {
  products: Product[];
  deletingProductId: string | null;
  updatingFlagsProductId: string | null;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onToggleFlag: (product: Product, flag: ProductFlagKey) => void;
};

const statusVariantMap: Record<ProductStatus, 'success' | 'warning' | 'muted'> = {
  active: 'success',
  draft: 'warning',
  archived: 'muted',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatStatus(status: ProductStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function ProductTable({
  products,
  deletingProductId,
  updatingFlagsProductId,
  onEdit,
  onDelete,
  onToggleFlag,
}: ProductTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Image</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Base Price</TableHead>
          <TableHead>Discount</TableHead>
          <TableHead>Final Price</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Featured</TableHead>
          <TableHead>Trending</TableHead>
          <TableHead>Best Seller</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>
              <img
                src={product.imageUrl}
                alt={product.title}
                className="h-12 w-12 rounded-md border object-cover"
                onError={(event) => {
                  const image = event.currentTarget;
                  image.onerror = null;
                  image.src = buildProductPlaceholderImage(product.title);
                }}
              />
            </TableCell>
            <TableCell>
              <p className="font-medium text-foreground">{product.title}</p>
              <p className="text-xs text-muted-foreground">Readonly title</p>
            </TableCell>
            <TableCell className="font-medium">{formatCurrency(product.price)}</TableCell>
            <TableCell>
              {product.hasDiscount ? (
                <p className="text-sm font-medium text-emerald-700">
                  {product.discountType === 'percentage'
                    ? `${product.discountValue}% off`
                    : `${formatCurrency(product.discountValue)} off`}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No discount</p>
              )}
            </TableCell>
            <TableCell className="font-medium text-emerald-700">{formatCurrency(product.discountedPrice)}</TableCell>
            <TableCell>
              <Badge variant={statusVariantMap[product.status]}>{formatStatus(product.status)}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={product.isFeatured ? 'info' : 'muted'}>
                {product.isFeatured ? 'Yes' : 'No'}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={product.isTrending ? 'info' : 'muted'}>
                {product.isTrending ? 'Yes' : 'No'}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={product.isBestSeller ? 'info' : 'muted'}>
                {product.isBestSeller ? 'Yes' : 'No'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="inline-flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onEdit(product)}>
                  <PencilLine className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onToggleFlag(product, 'isFeatured')}
                  disabled={updatingFlagsProductId === product.id}
                >
                  {updatingFlagsProductId === product.id
                    ? 'Updating...'
                    : product.isFeatured
                      ? 'Unfeature'
                      : 'Feature'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onToggleFlag(product, 'isTrending')}
                  disabled={updatingFlagsProductId === product.id}
                >
                  {updatingFlagsProductId === product.id
                    ? 'Updating...'
                    : product.isTrending
                      ? 'Untrend'
                      : 'Trend'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onToggleFlag(product, 'isBestSeller')}
                  disabled={updatingFlagsProductId === product.id}
                >
                  {updatingFlagsProductId === product.id
                    ? 'Updating...'
                    : product.isBestSeller
                      ? 'Unset Best'
                      : 'Best Seller'}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(product)}
                  disabled={deletingProductId === product.id}
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingProductId === product.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
