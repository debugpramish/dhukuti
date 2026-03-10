import { httpRequest, unwrapData } from './httpClient';
import {
  ORDER_COD_STATUS_VALUES,
  ORDER_PAYMENT_METHOD_VALUES,
  ORDER_PAYMENT_STATUS_VALUES,
  ORDER_STATUS_VALUES,
  SHIPMENT_STATUS_VALUES,
  type Order,
  type OrderItem,
  type OrderCodStatus,
  type OrderPaymentMethod,
  type OrderPaymentStatus,
  type OrderStatus,
  type ShipmentStatus,
} from './types';

type OrdersPayload = Order[] | { orders: Order[] };
type OrderPayload = Order | { order: Order };
type OrdersResponse = OrdersPayload | { data: OrdersPayload };
type OrderResponse = OrderPayload | { data: OrderPayload };

function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUS_VALUES.some((status) => status === value);
}

function isOrderPaymentMethod(value: string): value is OrderPaymentMethod {
  return ORDER_PAYMENT_METHOD_VALUES.some((method) => method === value);
}

function isOrderPaymentStatus(value: string): value is OrderPaymentStatus {
  return ORDER_PAYMENT_STATUS_VALUES.some((status) => status === value);
}

function isOrderCodStatus(value: string): value is OrderCodStatus {
  return ORDER_COD_STATUS_VALUES.some((status) => status === value);
}

function isShipmentStatus(value: string): value is ShipmentStatus {
  return SHIPMENT_STATUS_VALUES.some((status) => status === value);
}

function normalizeStatus(status: string): OrderStatus {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  return isOrderStatus(normalized) ? normalized : 'pending';
}

function normalizePaymentMethod(value: string): OrderPaymentMethod {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return isOrderPaymentMethod(normalized) ? normalized : 'cod';
}

function normalizePaymentStatus(value: string): OrderPaymentStatus {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return isOrderPaymentStatus(normalized) ? normalized : 'pending';
}

function normalizeCodStatus(value: string, paymentMethod: OrderPaymentMethod): OrderCodStatus {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  if (isOrderCodStatus(normalized)) {
    return normalized;
  }

  return paymentMethod === 'cod' ? 'pending' : 'not_applicable';
}

function normalizeShipmentStatus(value: string): ShipmentStatus {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  return isShipmentStatus(normalized) ? normalized : 'pending';
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

  const history = Array.isArray(shipment.history)
    ? shipment.history.map((entry) => ({
        status: normalizeShipmentStatus(String(entry.status ?? 'pending')),
        timestamp: (() => {
          const parsed = new Date(entry.timestamp);
          return Number.isNaN(parsed.getTime()) ? String(entry.timestamp ?? '') : parsed.toISOString();
        })(),
        note: typeof entry.note === 'string' ? entry.note : undefined,
      }))
    : [];

  return {
    courier: String(shipment.courier ?? ''),
    trackingNumber: String(shipment.trackingNumber ?? ''),
    labelUrl: String(shipment.labelUrl ?? ''),
    status: normalizeShipmentStatus(String(shipment.status ?? 'pending')),
    estimatedDeliveryAt: shipment.estimatedDeliveryAt
      ? new Date(shipment.estimatedDeliveryAt).toISOString()
      : undefined,
    lastUpdatedAt: shipment.lastUpdatedAt ? new Date(shipment.lastUpdatedAt).toISOString() : undefined,
    history,
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

function normalizeOrders(payload: OrdersPayload): Order[] {
  const orders = Array.isArray(payload) ? payload : payload.orders;
  const orderList = Array.isArray(orders) ? orders : [];
  return orderList.map(normalizeOrder);
}

function normalizeSingleOrder(payload: OrderPayload): Order {
  const order = 'order' in payload ? payload.order : payload;
  return normalizeOrder(order);
}

export async function getOrders(): Promise<Order[]> {
  const response = await httpRequest<OrdersResponse>('/api/orders', {
    method: 'GET',
  });

  return normalizeOrders(unwrapData<OrdersPayload>(response));
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const response = await httpRequest<OrderResponse>(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status },
  });

  return normalizeSingleOrder(unwrapData<OrderPayload>(response));
}
