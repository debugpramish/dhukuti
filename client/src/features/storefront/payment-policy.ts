import type { CartItem, ProductPaymentPolicy } from '@/features/storefront/types';

export type AllowedPaymentMethod = 'ONLINE' | 'COD';

export function normalizeProductPaymentPolicy(policy: unknown): ProductPaymentPolicy {
    if (typeof policy !== 'string') {
        return 'POSTPAID';
    }

    const normalized = policy.trim().toUpperCase();
    if (normalized === 'PREPAID_ONLY') {
        return 'PREPAID_ONLY';
    }

    if (normalized === 'POSTPAID' || normalized === 'COD_ALLOWED') {
        return 'POSTPAID';
    }

    return 'POSTPAID';
}

export function getAllowedPaymentMethods(cart: Array<Pick<CartItem, 'paymentPolicy'>>): AllowedPaymentMethod[] {
    const hasPrepaidOnly = cart.some((item) => normalizeProductPaymentPolicy(item.paymentPolicy) === 'PREPAID_ONLY');

    if (hasPrepaidOnly) {
        return ['ONLINE'];
    }

    return ['ONLINE', 'COD'];
}

export function cartContainsPrepaidOnlyItems(cart: Array<Pick<CartItem, 'paymentPolicy'>>): boolean {
    return !getAllowedPaymentMethods(cart).includes('COD');
}
