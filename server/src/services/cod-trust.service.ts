import CustomerModel from '../models/customer.model';
import OrderModel from '../models/order.model';

export type CheckoutRiskBand = 'low' | 'medium' | 'high';
export type CheckoutPolicyMode = 'cod_allowed' | 'partial_prepay' | 'prepaid_only';
export type CheckoutPaymentMethod = 'cod' | 'esewa' | 'khalti';

export type CodTrustEvaluation = {
    trustScore: number;
    riskBand: CheckoutRiskBand;
    mode: CheckoutPolicyMode;
    allowedPaymentMethods: CheckoutPaymentMethod[];
    codRequiresPrepay: boolean;
    requiredPrepayRatio: number;
    requiredPrepayAmount: number;
    reason: string;
};

type EvaluateCodTrustInput = {
    ownerId: string;
    customerId: string;
    orderTotal: number;
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function roundCurrency(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function daysSince(date: Date | undefined | null): number {
    if (!date) {
        return 0;
    }

    const diffMs = Date.now() - date.getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) {
        return 0;
    }

    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function buildReason(params: {
    mode: CheckoutPolicyMode;
    codFailedOrders: number;
    cancelledOrders: number;
    deliveredCodOrders: number;
    totalOrders: number;
    requiredPrepayAmount: number;
}): string {
    if (params.mode === 'prepaid_only') {
        if (params.codFailedOrders > 0) {
            return 'COD is disabled due to prior failed COD deliveries on this account.';
        }

        if (params.cancelledOrders >= 3) {
            return 'COD is disabled due to repeated order cancellations.';
        }

        return 'Online payment is required for this checkout.';
    }

    if (params.mode === 'partial_prepay') {
        return `COD requires a prepayment of NPR ${params.requiredPrepayAmount.toFixed(2)}. Use eSewa or Khalti for now.`;
    }

    if (params.deliveredCodOrders >= 2) {
        return 'COD is available based on strong delivery history.';
    }

    if (params.totalOrders === 0) {
        return 'COD is available for this first order.';
    }

    return 'COD is available for this checkout.';
}

export async function evaluateCodTrustPolicy(input: EvaluateCodTrustInput): Promise<CodTrustEvaluation> {
    const recentWindow = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [
        totalOrders,
        deliveredCodOrders,
        codFailedOrders,
        cancelledOrders,
        paidPrepaidOrders,
        recentOrders,
        customer,
    ] = await Promise.all([
        OrderModel.countDocuments({ ownerId: input.ownerId, customerId: input.customerId }),
        OrderModel.countDocuments({
            ownerId: input.ownerId,
            customerId: input.customerId,
            paymentMethod: 'cod',
            $or: [{ codStatus: 'collected' }, { status: 'delivered' }],
        }),
        OrderModel.countDocuments({
            ownerId: input.ownerId,
            customerId: input.customerId,
            paymentMethod: 'cod',
            codStatus: 'failed',
        }),
        OrderModel.countDocuments({
            ownerId: input.ownerId,
            customerId: input.customerId,
            status: 'cancelled',
        }),
        OrderModel.countDocuments({
            ownerId: input.ownerId,
            customerId: input.customerId,
            paymentMethod: { $in: ['esewa', 'khalti'] },
            paymentStatus: 'paid',
        }),
        OrderModel.countDocuments({
            ownerId: input.ownerId,
            customerId: input.customerId,
            createdAt: { $gte: recentWindow },
        }),
        CustomerModel.findById(input.customerId).select({ createdAt: 1 }).lean(),
    ]);

    const accountAgeDays = daysSince(customer?.createdAt ?? null);
    let trustScore = 50;

    if (totalOrders === 0) {
        trustScore -= 12;
    }

    trustScore += Math.min(deliveredCodOrders * 12, 36);
    trustScore += Math.min(paidPrepaidOrders * 8, 24);
    trustScore -= Math.min(cancelledOrders * 15, 45);
    trustScore -= Math.min(codFailedOrders * 30, 60);

    if (recentOrders >= 2) {
        trustScore += Math.min(recentOrders * 2, 10);
    }

    if (accountAgeDays >= 90) {
        trustScore += 8;
    } else if (accountAgeDays > 0 && accountAgeDays < 14) {
        trustScore -= 8;
    }

    if (totalOrders === 0 && input.orderTotal >= 7000) {
        trustScore -= 10;
    }

    trustScore = clamp(Math.round(trustScore), 0, 100);

    let mode: CheckoutPolicyMode;
    if (codFailedOrders >= 2 || (cancelledOrders >= 3 && deliveredCodOrders === 0)) {
        mode = 'prepaid_only';
    } else if (trustScore < 45) {
        mode = 'prepaid_only';
    } else if (trustScore < 70) {
        mode = 'partial_prepay';
    } else {
        mode = 'cod_allowed';
    }

    const requiredPrepayRatio = mode === 'partial_prepay' ? 0.35 : 0;
    const requiredPrepayAmount = roundCurrency(input.orderTotal * requiredPrepayRatio);

    const allowedPaymentMethods: CheckoutPaymentMethod[] =
        mode === 'cod_allowed' ? ['cod', 'esewa', 'khalti'] : ['esewa', 'khalti'];

    let riskBand: CheckoutRiskBand = 'low';
    if (trustScore < 45) {
        riskBand = 'high';
    } else if (trustScore < 70) {
        riskBand = 'medium';
    }

    return {
        trustScore,
        riskBand,
        mode,
        allowedPaymentMethods,
        codRequiresPrepay: mode === 'partial_prepay',
        requiredPrepayRatio,
        requiredPrepayAmount,
        reason: buildReason({
            mode,
            codFailedOrders,
            cancelledOrders,
            deliveredCodOrders,
            totalOrders,
            requiredPrepayAmount,
        }),
    };
}
