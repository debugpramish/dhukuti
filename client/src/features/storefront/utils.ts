import type { ShippingMethod } from '@/features/storefront/types';

export const DEFAULT_SHIPPING_METHODS: ShippingMethod[] = [
  { id: 'standard', label: 'Standard Shipping', price: 4.99, eta: '3-5 business days' },
  { id: 'express', label: 'Express Shipping', price: 12.99, eta: '1-2 business days' },
];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getDeliveryEstimate(days = 5): string {
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + days);

  return estimatedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
