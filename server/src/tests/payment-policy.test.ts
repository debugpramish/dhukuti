import assert from 'node:assert/strict';

import {
    getAllowedPaymentMethods,
    normalizeProductPaymentPolicy,
} from '../services/payment-policy.service';

function runPaymentPolicyTests() {
    // Alias should map to POSTPAID for backward compatibility.
    assert.equal(normalizeProductPaymentPolicy('COD_ALLOWED'), 'POSTPAID');
    assert.equal(normalizeProductPaymentPolicy('POSTPAID'), 'POSTPAID');
    assert.equal(normalizeProductPaymentPolicy('PREPAID_ONLY'), 'PREPAID_ONLY');

    const allPostpaid = getAllowedPaymentMethods([
        { paymentPolicy: 'POSTPAID' },
        { paymentPolicy: 'COD_ALLOWED' },
    ]);
    assert.deepEqual(allPostpaid, ['ONLINE', 'COD']);

    const mixedCart = getAllowedPaymentMethods([
        { paymentPolicy: 'PREPAID_ONLY' },
        { paymentPolicy: 'POSTPAID' },
    ]);
    assert.deepEqual(mixedCart, ['ONLINE']);

    const prepaidOnlyCart = getAllowedPaymentMethods([{ paymentPolicy: 'PREPAID_ONLY' }]);
    assert.deepEqual(prepaidOnlyCart, ['ONLINE']);

    console.log('payment-policy tests passed');
}

runPaymentPolicyTests();
