import { httpRequest, unwrapData } from './httpClient';
import {
  ORDER_COD_STATUS_VALUES,
  ORDER_PAYMENT_METHOD_VALUES,
  ORDER_PAYMENT_STATUS_VALUES,
  ORDER_STATUS_VALUES,
  SHIPMENT_STATUS_VALUES,
  STORE_COURIER_VALUES,
  type CourierOption,
  type CourierQuote,
  type FulfillmentCodInput,
  type FulfillmentOrder,
  type FulfillmentShipmentInput,
  type FulfillmentShipmentStatusInput,
  type OrderCodStatus,
  type OrderPaymentMethod,
  type OrderPaymentStatus,
  type OrderStatus,
  type ShipmentStatus,
  type ShippingRules,
  type StoreCourier,
} from './types';

type ShippingSettingsPayload = ShippingRules | { shippingRules: ShippingRules };
type ShippingSettingsResponse = ShippingSettingsPayload | { data: ShippingSettingsPayload };
type FulfillmentOrdersPayload = FulfillmentOrder[] | { orders: FulfillmentOrder[] };
type FulfillmentOrdersResponse = FulfillmentOrdersPayload | { data: FulfillmentOrdersPayload };
type FulfillmentOrderPayload = FulfillmentOrder | { order: FulfillmentOrder };
type FulfillmentOrderResponse = FulfillmentOrderPayload | { data: FulfillmentOrderPayload };
type CouriersPayload = CourierOption[] | { couriers: CourierOption[] };
type CouriersResponse = CouriersPayload | { data: CouriersPayload };
type CourierQuotesPayload = CourierQuote[] | { quotes: CourierQuote[] };
type CourierQuotesResponse = CourierQuotesPayload | { data: CourierQuotesPayload };

const orderStatusSet = new Set<string>(ORDER_STATUS_VALUES);
const paymentMethodSet = new Set<string>(ORDER_PAYMENT_METHOD_VALUES);
const paymentStatusSet = new Set<string>(ORDER_PAYMENT_STATUS_VALUES);
const codStatusSet = new Set<string>(ORDER_COD_STATUS_VALUES);
const shipmentStatusSet = new Set<string>(SHIPMENT_STATUS_VALUES);
const courierSet = new Set<string>(STORE_COURIER_VALUES);

function normalizeOrderStatus(value: string): OrderStatus {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
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

function normalizeCourier(value: string): StoreCourier {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return courierSet.has(normalized) ? (normalized as StoreCourier) : 'nepal-post';
}

function normalizeShippingRules(payload: ShippingSettingsPayload): ShippingRules {
  const shippingRules = 'shippingRules' in payload ? payload.shippingRules : payload;
  const supportedCouriers = Array.isArray(shippingRules.supportedCouriers) && shippingRules.supportedCouriers.length > 0
    ? shippingRules.supportedCouriers.map((courier) => normalizeCourier(courier))
    : [...STORE_COURIER_VALUES];
  const defaultCourier = supportedCouriers.includes(normalizeCourier(shippingRules.defaultCourier))
    ? normalizeCourier(shippingRules.defaultCourier)
    : supportedCouriers[0];

  return {
    baseFee: Number(shippingRules.baseFee ?? 100),
    freeShippingAbove: Number(shippingRules.freeShippingAbove ?? 1000),
    codEnabled: Boolean(shippingRules.codEnabled ?? true),
    codFee: Number(shippingRules.codFee ?? 50),
    defaultCourier,
    supportedCouriers,
  };
}

function normalizeFulfillmentOrder(order: FulfillmentOrder): FulfillmentOrder {
  const paymentMethod = normalizePaymentMethod(String(order.paymentMethod ?? 'cod'));

  return {
    ...order,
    customerPhone: String(order.customerPhone ?? ''),
    customerLocation: String(order.customerLocation ?? ''),
    subtotal: Number(order.subtotal ?? order.total ?? 0),
    productDiscountTotal: Number(order.productDiscountTotal ?? 0),
    couponDiscountTotal: Number(order.couponDiscountTotal ?? 0),
    discountTotal: Number(order.discountTotal ?? 0),
    shippingFee: Number(order.shippingFee ?? 0),
    codFee: Number(order.codFee ?? 0),
    total: Number(order.total ?? 0),
    status: normalizeOrderStatus(order.status),
    paymentMethod,
    paymentStatus: normalizePaymentStatus(String(order.paymentStatus ?? 'pending')),
    paymentReference: typeof order.paymentReference === 'string' ? order.paymentReference : undefined,
    codStatus: normalizeCodStatus(String(order.codStatus ?? ''), paymentMethod),
    codCollectedAmount: Number(order.codCollectedAmount ?? 0),
    shipment: order.shipment
      ? {
          courier: String(order.shipment.courier ?? ''),
          trackingNumber: String(order.shipment.trackingNumber ?? ''),
          labelUrl: String(order.shipment.labelUrl ?? ''),
          status: normalizeShipmentStatus(String(order.shipment.status ?? 'pending')),
          estimatedDeliveryAt: order.shipment.estimatedDeliveryAt
            ? new Date(order.shipment.estimatedDeliveryAt).toISOString()
            : undefined,
          lastUpdatedAt: order.shipment.lastUpdatedAt
            ? new Date(order.shipment.lastUpdatedAt).toISOString()
            : undefined,
          history: Array.isArray(order.shipment.history)
            ? order.shipment.history.map((entry) => ({
                status: normalizeShipmentStatus(String(entry.status ?? 'pending')),
                timestamp: (() => {
                  const parsed = new Date(entry.timestamp);
                  return Number.isNaN(parsed.getTime()) ? String(entry.timestamp ?? '') : parsed.toISOString();
                })(),
                note: typeof entry.note === 'string' ? entry.note : undefined,
              }))
            : [],
        }
      : null,
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity ?? 0),
          unitPrice: Number(item.unitPrice ?? 0),
        }))
      : [],
  };
}

function normalizeOrders(payload: FulfillmentOrdersPayload): FulfillmentOrder[] {
  const orders = Array.isArray(payload) ? payload : payload.orders;
  const list = Array.isArray(orders) ? orders : [];
  return list.map(normalizeFulfillmentOrder);
}

function normalizeSingleOrder(payload: FulfillmentOrderPayload): FulfillmentOrder {
  const order = 'order' in payload ? payload.order : payload;
  return normalizeFulfillmentOrder(order);
}

function normalizeCouriers(payload: CouriersPayload): CourierOption[] {
  const couriers = Array.isArray(payload) ? payload : payload.couriers;
  const list = Array.isArray(couriers) ? couriers : [];

  return list.map((courier) => ({
    id: normalizeCourier(courier.id),
    name: String(courier.name ?? ''),
    supportsCod: Boolean(courier.supportsCod),
  }));
}

function normalizeCourierQuotes(payload: CourierQuotesPayload): CourierQuote[] {
  const quotes = Array.isArray(payload) ? payload : payload.quotes;
  const list = Array.isArray(quotes) ? quotes : [];

  return list.map((quote) => ({
    courier: normalizeCourier(quote.courier),
    destination: String(quote.destination ?? ''),
    estimatedFee: Number(quote.estimatedFee ?? 0),
    estimatedDays: Number(quote.estimatedDays ?? 0),
  }));
}

export async function getShippingRules(): Promise<ShippingRules> {
  const response = await httpRequest<ShippingSettingsResponse>('/api/fulfillment/settings', {
    method: 'GET',
  });

  return normalizeShippingRules(unwrapData<ShippingSettingsPayload>(response));
}

export async function updateShippingRules(payload: ShippingRules): Promise<ShippingRules> {
  const response = await httpRequest<ShippingSettingsResponse>('/api/fulfillment/settings', {
    method: 'PUT',
    body: payload,
  });

  return normalizeShippingRules(unwrapData<ShippingSettingsPayload>(response));
}

export async function getFulfillmentOrders(): Promise<FulfillmentOrder[]> {
  const response = await httpRequest<FulfillmentOrdersResponse>('/api/fulfillment/orders', {
    method: 'GET',
  });

  return normalizeOrders(unwrapData<FulfillmentOrdersPayload>(response));
}

export async function createShipment(orderId: string, payload: FulfillmentShipmentInput): Promise<FulfillmentOrder> {
  const response = await httpRequest<FulfillmentOrderResponse>(`/api/fulfillment/orders/${orderId}/shipments`, {
    method: 'POST',
    body: payload,
  });

  return normalizeSingleOrder(unwrapData<FulfillmentOrderPayload>(response));
}

export async function updateShipmentStatus(
  orderId: string,
  payload: FulfillmentShipmentStatusInput,
): Promise<FulfillmentOrder> {
  const response = await httpRequest<FulfillmentOrderResponse>(`/api/fulfillment/orders/${orderId}/shipments/status`, {
    method: 'PATCH',
    body: payload,
  });

  return normalizeSingleOrder(unwrapData<FulfillmentOrderPayload>(response));
}

export async function updateCodTracking(orderId: string, payload: FulfillmentCodInput): Promise<FulfillmentOrder> {
  const response = await httpRequest<FulfillmentOrderResponse>(`/api/fulfillment/orders/${orderId}/cod`, {
    method: 'PATCH',
    body: payload,
  });

  return normalizeSingleOrder(unwrapData<FulfillmentOrderPayload>(response));
}

export async function getCourierOptions(): Promise<CourierOption[]> {
  const response = await httpRequest<CouriersResponse>('/api/fulfillment/couriers', {
    method: 'GET',
  });

  return normalizeCouriers(unwrapData<CouriersPayload>(response));
}

export async function getCourierQuotes(destination: string, weightKg: number): Promise<CourierQuote[]> {
  const response = await httpRequest<CourierQuotesResponse>('/api/fulfillment/couriers/quote', {
    method: 'POST',
    body: {
      destination,
      weightKg,
    },
  });

  return normalizeCourierQuotes(unwrapData<CourierQuotesPayload>(response));
}
