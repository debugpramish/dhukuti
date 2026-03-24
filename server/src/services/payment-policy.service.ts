export type ProductPaymentPolicy = 'PREPAID_ONLY' | 'POSTPAID';
export type CartPaymentMethod = 'ONLINE' | 'COD';

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

export function getAllowedPaymentMethods(cart: Array<{ paymentPolicy?: unknown }>): CartPaymentMethod[] {
    const hasPrepaidOnlyItem = cart.some(
        (item) => normalizeProductPaymentPolicy(item.paymentPolicy) === 'PREPAID_ONLY',
    );

    if (hasPrepaidOnlyItem) {
        return ['ONLINE'];
    }

    return ['ONLINE', 'COD'];
}
