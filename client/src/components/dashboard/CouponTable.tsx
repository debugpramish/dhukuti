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
import type { Coupon } from '@/services/api/types';

type CouponTableProps = {
  coupons: Coupon[];
  deletingCouponId: string | null;
  togglingCouponId: string | null;
  onEdit: (coupon: Coupon) => void;
  onDelete: (coupon: Coupon) => void;
  onToggleActive: (coupon: Coupon) => void;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatCouponValue(coupon: Coupon): string {
  if (coupon.type === 'percentage') {
    return `${coupon.value}%`;
  }

  return formatCurrency(coupon.value);
}

function formatDate(value?: string): string {
  if (!value) {
    return 'No expiry';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No expiry';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CouponTable({
  coupons,
  deletingCouponId,
  togglingCouponId,
  onEdit,
  onDelete,
  onToggleActive,
}: CouponTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Min Order</TableHead>
          <TableHead>Usage</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {coupons.map((coupon) => (
          <TableRow key={coupon.id}>
            <TableCell className="font-medium">{coupon.code}</TableCell>
            <TableCell>{coupon.type === 'percentage' ? 'Percentage' : 'Fixed'}</TableCell>
            <TableCell>{formatCouponValue(coupon)}</TableCell>
            <TableCell>{formatCurrency(coupon.minOrderAmount)}</TableCell>
            <TableCell>
              {coupon.usageCount}
              {typeof coupon.usageLimit === 'number' ? ` / ${coupon.usageLimit}` : ''}
            </TableCell>
            <TableCell>{formatDate(coupon.expiresAt)}</TableCell>
            <TableCell>
              <Badge variant={coupon.isActive ? 'success' : 'muted'}>
                {coupon.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="inline-flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => onEdit(coupon)}>
                  <PencilLine className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={togglingCouponId === coupon.id}
                  onClick={() => onToggleActive(coupon)}
                >
                  {togglingCouponId === coupon.id
                    ? 'Updating...'
                    : coupon.isActive
                      ? 'Deactivate'
                      : 'Activate'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={deletingCouponId === coupon.id}
                  onClick={() => onDelete(coupon)}
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingCouponId === coupon.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
