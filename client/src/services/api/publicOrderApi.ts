import { getCustomerAuthToken } from '@/lib/customer-auth';
import { httpRequest, unwrapData } from './httpClient';
import {
  ORDER_COD_STATUS_VALUES,
  ORDER_PAYMENT_METHOD_VALUES,
  ORDER_PAYMENT_STATUS_VALUES,
  ORDER_STATUS_VALUES,
  SHIPMENT_STATUS_VALUES,
  type CheckoutBill,
  type DummyPayment,
  type DummyPaymentProvider,
  type Order,
  type OrderCodStatus,
  type OrderItem,
  type OrderPaymentMethod,
  type OrderPaymentStatus,
  type OrderStatus,
  type ShipmentStatus,
} from './types';

export type CreatePublicOrderItemInput = {
  productId: string;
  quantity: number;
  variantId?: string;
  sku?: string;
};

export type PublicCheckoutCustomerInput = {
  customerName: string;
  customerPhone: string;
  customerLocation: string;
};

export type PublicCheckoutOptions = {
  couponCode?: string;
  paymentMethod?: OrderPaymentMethod;
  paymentSessionId?: string;
  trafficSource?: string;
  sessionId?: string;
};

type BillPayload = CheckoutBill | { bill: CheckoutBill };
type BillResponse = BillPayload | { data: BillPayload };
type OrderPayload = Order | { order: Order };
type OrderResponse = OrderPayload | { data: OrderPayload };
type PaymentPayload = DummyPayment | { payment: DummyPayment };
type PaymentResponse = PaymentPayload | { data: PaymentPayload };
type PaymentWithBillPayload = { payment: DummyPayment; bill: CheckoutBill };
type PaymentWithBillResponse = PaymentWithBillPayload | { data: PaymentWithBillPayload };

const orderStatusSet = new Set<string>(ORDER_STATUS_VALUES);
const paymentMethodSet = new Set<string>(ORDER_PAYMENT_METHOD_VALUES);
const paymentStatusSet = new Set<string>(ORDER_PAYMENT_STATUS_VALUES);
const codStatusSet = new Set<string>(ORDER_COD_STATUS_VALUES);
const shipmentStatusSet = new Set<string>(SHIPMENT_STATUS_VALUES);

function normalizeStatus(status: string): OrderStatus {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  return orderStatusSet.has(normalized) ? (normalized as OrderStatus) : 'pending';
}

function normalizePaymentMethod(value: string): OrderPaymentMethod {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return paymentMethodSet.has(normalized) ? (normalized as OrderPaymentMethod) : 'cod';
}

function normalizePaymentStatus(value: string): OrderPaymentStatus {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return paymentStatusSet.has(normalized) ? (normalized as OrderPaymentStatus) : 'pending';
}

function normalizeCodStatus(value: string, paymentMethod: OrderPaymentMethod): OrderCodStatus {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  if (codStatusSet.has(normalized)) {
    return normalized as OrderCodStatus;
  }

  return paymentMethod === 'cod' ? 'pending' : 'not_applicable';
}

function normalizeShipmentStatus(value: string): ShipmentStatus {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return shipmentStatusSet.has(normalized) ? (normalized as ShipmentStatus) : 'pending';
}

function normalizeItems(items: OrderItem[]): OrderItem[] {
  const orderItems = Array.isArray(items) ? items : [];

  return orderItems.map((item) => ({
    ...item,
    quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unitPrice ?? 0),
  }));
}

function normalizeShipment(shipment: Order['shipment']): Order['shipment'] {
  if (!shipment) {
    return null;
  }

  return {
    courier: String(shipment.courier ?? ''),
    trackingNumber: String(shipment.trackingNumber ?? ''),
    labelUrl: String(shipment.labelUrl ?? ''),
    status: normalizeShipmentStatus(String(shipment.status ?? 'pending')),
    estimatedDeliveryAt: shipment.estimatedDeliveryAt
      ? new Date(shipment.estimatedDeliveryAt).toISOString()
      : undefined,
    lastUpdatedAt: shipment.lastUpdatedAt ? new Date(shipment.lastUpdatedAt).toISOString() : undefined,
    history: Array.isArray(shipment.history)
      ? shipment.history.map((entry) => ({
          status: normalizeShipmentStatus(String(entry.status ?? 'pending')),
          timestamp: (() => {
            const parsed = new Date(entry.timestamp);
            return Number.isNaN(parsed.getTime()) ? String(entry.timestamp ?? '') : parsed.toISOString();
          })(),
          note: typeof entry.note === 'string' ? entry.note : undefined,
        }))
      : [],
  };
}

function normalizeOrder(order: Order): Order {
  const subtotal = Number(order.subtotal ?? order.total ?? 0);
  const productDiscountTotal = Number(order.productDiscountTotal ?? 0);
  const couponDiscountTotal = Number(order.couponDiscountTotal ?? 0);
  const discountTotal = Number(order.discountTotal ?? productDiscountTotal + couponDiscountTotal);
  const paymentMethod = normalizePaymentMethod(String(order.paymentMethod ?? 'cod'));

  return {
    ...order,
    customerPhone: String(order.customerPhone ?? ''),
    customerLocation: String(order.customerLocation ?? ''),
    subtotal,
    productDiscountTotal,
    couponDiscountTotal,
    discountTotal,
    shippingFee: Number(order.shippingFee ?? 0),
    codFee: Number(order.codFee ?? 0),
    total: Number(order.total ?? 0),
    couponCode: order.couponCode ? String(order.couponCode).toUpperCase() : undefined,
    status: normalizeStatus(order.status),
    paymentMethod,
    paymentStatus: normalizePaymentStatus(String(order.paymentStatus ?? 'pending')),
    paymentReference: typeof order.paymentReference === 'string' ? order.paymentReference : undefined,
    codStatus: normalizeCodStatus(String(order.codStatus ?? ''), paymentMethod),
    codCollectedAmount: Number(order.codCollectedAmount ?? 0),
    shipment: normalizeShipment(order.shipment),
    items: normalizeItems(order.items),
  };
}

function normalizeBill(bill: CheckoutBill): CheckoutBill {
  const subtotal = Number(bill.subtotal ?? 0);
  const productDiscountTotal = Number(bill.productDiscountTotal ?? 0);
  const couponDiscountTotal = Number(bill.couponDiscountTotal ?? 0);
  const discountTotal = Number(bill.discountTotal ?? productDiscountTotal + couponDiscountTotal);
  const paymentMethod = normalizePaymentMethod(String(bill.paymentMethod ?? 'cod'));

  return {
    subtotal,
    productDiscountTotal,
    couponCode: bill.couponCode ? String(bill.couponCode).toUpperCase() : undefined,
    couponDiscountTotal,
    discountTotal,
    shippingFee: Number(bill.shippingFee ?? 0),
    codFee: Number(bill.codFee ?? 0),
    paymentMethod,
    total: Number(bill.total ?? 0),
  };
}

function normalizeDummyPayment(payment: DummyPayment): DummyPayment {
  const provider = payment.provider === 'khalti' ? 'khalti' : 'esewa';
  const status = payment.status === 'verified' ? 'verified' : 'initiated';

  return {
    provider,
    paymentSessionId: String(payment.paymentSessionId ?? ''),
    status,
    amount: Number(payment.amount ?? 0),
    paymentReference: typeof payment.paymentReference === 'string' ? payment.paymentReference : undefined,
    expiresAt: new Date(payment.expiresAt).toISOString(),
    gatewayPayload:
      payment.gatewayPayload && typeof payment.gatewayPayload === 'object'
        ? payment.gatewayPayload
        : undefined,
  };
}

function normalizeSingleBill(payload: BillPayload): CheckoutBill {
  const bill = 'bill' in payload ? payload.bill : payload;
  return normalizeBill(bill);
}

function normalizeSingleOrder(payload: OrderPayload): Order {
  const order = 'order' in payload ? payload.order : payload;
  return normalizeOrder(order);
}

function normalizeSinglePayment(payload: PaymentPayload): DummyPayment {
  const payment = 'payment' in payload ? payload.payment : payload;
  return normalizeDummyPayment(payment);
}

function buildCustomerAuthHeaders() {
  const customerToken = getCustomerAuthToken();
  return customerToken ? { Authorization: `Bearer ${customerToken}` } : undefined;
}

function createCheckoutRequestBody(
  items: CreatePublicOrderItemInput[],
  customer: PublicCheckoutCustomerInput,
  options?: PublicCheckoutOptions,
) {
  return {
    customerName: customer.customerName,
    customerPhone: customer.customerPhone,
    customerLocation: customer.customerLocation,
    items,
    paymentMethod: options?.paymentMethod ?? 'cod',
    ...(options?.couponCode ? { couponCode: options.couponCode } : {}),
    ...(options?.paymentSessionId ? { paymentSessionId: options.paymentSessionId } : {}),
    ...(options?.trafficSource ? { trafficSource: options.trafficSource } : {}),
    ...(options?.sessionId ? { sessionId: options.sessionId } : {}),
  };
}

export async function previewPublicOrder(
  slug: string,
  items: CreatePublicOrderItemInput[],
  customer: PublicCheckoutCustomerInput,
  options?: PublicCheckoutOptions,
): Promise<CheckoutBill> {
  const response = await httpRequest<BillResponse>(`/public/stores/${slug}/orders/preview`, {
    method: 'POST',
    body: createCheckoutRequestBody(items, customer, options),
    headers: buildCustomerAuthHeaders(),
    skipAuth: true,
  });

  return normalizeSingleBill(unwrapData<BillPayload>(response));
}

export async function createPublicOrder(
  slug: string,
  items: CreatePublicOrderItemInput[],
  customer: PublicCheckoutCustomerInput,
  options?: PublicCheckoutOptions,
): Promise<Order> {
  const response = await httpRequest<OrderResponse>(`/public/stores/${slug}/orders`, {
    method: 'POST',
    body: createCheckoutRequestBody(items, customer, options),
    headers: buildCustomerAuthHeaders(),
    skipAuth: true,
  });

  return normalizeSingleOrder(unwrapData<OrderPayload>(response));
}

export async function initiateDummyPayment(
  slug: string,
  provider: DummyPaymentProvider,
  items: CreatePublicOrderItemInput[],
  customer: PublicCheckoutCustomerInput,
  couponCode?: string,
  tracking?: Pick<PublicCheckoutOptions, 'trafficSource' | 'sessionId'>,
): Promise<{ payment: DummyPayment; bill: CheckoutBill }> {
  const response = await httpRequest<PaymentWithBillResponse>(`/public/stores/${slug}/payments/${provider}/initiate`, {
    method: 'POST',
    body: createCheckoutRequestBody(items, customer, {
      couponCode,
      paymentMethod: provider,
      trafficSource: tracking?.trafficSource,
      sessionId: tracking?.sessionId,
    }),
    headers: buildCustomerAuthHeaders(),
    skipAuth: true,
  });

  const payload = unwrapData<PaymentWithBillPayload>(response);
  return {
    payment: normalizeDummyPayment(payload.payment),
    bill: normalizeBill(payload.bill),
  };
}

export async function verifyDummyPayment(slug: string, paymentSessionId: string): Promise<DummyPayment> {
  const response = await httpRequest<PaymentResponse>(`/public/stores/${slug}/payments/verify`, {
    method: 'POST',
    body: { paymentSessionId },
    headers: buildCustomerAuthHeaders(),
    skipAuth: true,
  });

  return normalizeSinglePayment(unwrapData<PaymentPayload>(response));
}
