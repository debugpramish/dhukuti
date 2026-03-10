import mongoose from 'mongoose';

import AbandonedCheckoutModel, {
  type AbandonedCheckoutDocument,
  type AbandonedCheckoutSource,
  type AbandonedReminderStatus,
} from '../models/abandoned-checkout.model';
import type { OrderPaymentMethod } from '../models/order.model';

export type CheckoutTrackingItem = {
  title: string;
  quantity: number;
  unitPrice: number;
  sku?: string;
  variantName?: string;
};

export type RecordAbandonedCheckoutInput = {
  ownerId: string;
  storeSlug: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerLocation: string;
  subtotal: number;
  productDiscountTotal: number;
  couponCode?: string;
  couponDiscountTotal: number;
  discountTotal: number;
  shippingFee: number;
  codFee: number;
  total: number;
  paymentMethod: OrderPaymentMethod;
  source: AbandonedCheckoutSource;
  items: CheckoutTrackingItem[];
  lastActivityAt?: Date;
};

export type SendReminderResult = {
  status: AbandonedReminderStatus;
  message: string;
};

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function recordAbandonedCheckout(input: RecordAbandonedCheckoutInput): Promise<void> {
  const ownerObjectId = new mongoose.Types.ObjectId(input.ownerId);
  const customerObjectId = new mongoose.Types.ObjectId(input.customerId);
  const normalizedSlug = input.storeSlug.trim().toLowerCase();
  const lastActivityAt = input.lastActivityAt ?? new Date();

  const normalizedItems = input.items.map((item) => ({
    title: item.title.trim(),
    quantity: Math.max(1, Math.floor(item.quantity)),
    unitPrice: roundCurrency(Math.max(item.unitPrice, 0)),
    sku: item.sku?.trim() || undefined,
    variantName: item.variantName?.trim() || undefined,
  }));

  const filter = {
    ownerId: ownerObjectId,
    storeSlug: normalizedSlug,
    customerId: customerObjectId,
    status: 'open' as const,
  };

  const update = {
    $set: {
      customerName: input.customerName.trim(),
      customerEmail: input.customerEmail.trim().toLowerCase(),
      customerPhone: input.customerPhone.trim(),
      customerLocation: input.customerLocation.trim(),
      subtotal: roundCurrency(Math.max(input.subtotal, 0)),
      productDiscountTotal: roundCurrency(Math.max(input.productDiscountTotal, 0)),
      couponCode: input.couponCode?.trim().toUpperCase() || undefined,
      couponDiscountTotal: roundCurrency(Math.max(input.couponDiscountTotal, 0)),
      discountTotal: roundCurrency(Math.max(input.discountTotal, 0)),
      shippingFee: roundCurrency(Math.max(input.shippingFee, 0)),
      codFee: roundCurrency(Math.max(input.codFee, 0)),
      total: roundCurrency(Math.max(input.total, 0)),
      paymentMethod: input.paymentMethod,
      source: input.source,
      lastActivityAt,
      items: normalizedItems,
    },
    $setOnInsert: {
      ownerId: ownerObjectId,
      storeSlug: normalizedSlug,
      customerId: customerObjectId,
      status: 'open' as const,
      reminderCount: 0,
      autoReminderCount: 0,
    },
  };

  try {
    await AbandonedCheckoutModel.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });
  } catch (error) {
    const errorCode = (error as { code?: number }).code;
    if (errorCode !== 11000) {
      throw error;
    }

    await AbandonedCheckoutModel.updateOne(filter, update);
  }
}

export async function markAbandonedCheckoutRecovered(params: {
  ownerId: string;
  storeSlug: string;
  customerId: string;
  orderId: mongoose.Types.ObjectId;
}): Promise<void> {
  const ownerObjectId = new mongoose.Types.ObjectId(params.ownerId);
  const customerObjectId = new mongoose.Types.ObjectId(params.customerId);

  await AbandonedCheckoutModel.findOneAndUpdate(
    {
      ownerId: ownerObjectId,
      storeSlug: params.storeSlug.trim().toLowerCase(),
      customerId: customerObjectId,
      status: 'open',
    },
    {
      $set: {
        status: 'recovered',
        recoveredAt: new Date(),
        recoveryOrderId: params.orderId,
        lastActivityAt: new Date(),
      },
    },
    {
      new: true,
      sort: { updatedAt: -1 },
    },
  );
}

export async function sendReminderForCheckout(params: {
  checkout: AbandonedCheckoutDocument;
  auto: boolean;
}): Promise<SendReminderResult> {
  const checkout = params.checkout;

  if (!checkout.customerEmail.trim()) {
    const message = 'Customer email is missing for this checkout';

    await AbandonedCheckoutModel.updateOne(
      { _id: checkout._id },
      {
        $set: {
          lastReminderSentAt: new Date(),
          lastReminderStatus: 'failed',
          lastReminderMessage: message,
        },
      },
    );

    return {
      status: 'failed',
      message,
    };
  }

  const reminderMessage = `Reminder ${params.auto ? 'auto-' : ''}sent (dummy channel)`;

  await AbandonedCheckoutModel.updateOne(
    { _id: checkout._id },
    {
      $set: {
        lastReminderSentAt: new Date(),
        lastReminderStatus: 'simulated',
        lastReminderMessage: reminderMessage,
      },
      $inc: {
        reminderCount: 1,
        ...(params.auto ? { autoReminderCount: 1 } : {}),
      },
    },
  );

  return {
    status: 'simulated',
    message: reminderMessage,
  };
}

export async function runAutoReminderDispatch(params: {
  ownerId: string;
  thresholdMinutes: number;
  cooldownMinutes: number;
  limit: number;
}): Promise<{
  scanned: number;
  sent: number;
  simulated: number;
  failed: number;
}> {
  const ownerObjectId = new mongoose.Types.ObjectId(params.ownerId);
  const thresholdDate = new Date(Date.now() - params.thresholdMinutes * 60 * 1000);
  const cooldownDate = new Date(Date.now() - params.cooldownMinutes * 60 * 1000);

  const candidates = await AbandonedCheckoutModel.find({
    ownerId: ownerObjectId,
    status: 'open',
    lastActivityAt: { $lte: thresholdDate },
    $or: [{ lastReminderSentAt: { $exists: false } }, { lastReminderSentAt: { $lte: cooldownDate } }],
  })
    .sort({ lastActivityAt: 1 })
    .limit(Math.max(1, Math.min(params.limit, 200)));

  let sent = 0;
  let simulated = 0;
  let failed = 0;

  for (const checkout of candidates) {
    const result = await sendReminderForCheckout({ checkout, auto: true });
    if (result.status === 'sent') {
      sent += 1;
    } else if (result.status === 'simulated') {
      simulated += 1;
    } else {
      failed += 1;
    }
  }

  return {
    scanned: candidates.length,
    sent,
    simulated,
    failed,
  };
}
