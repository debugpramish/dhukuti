import { httpRequest, unwrapData } from './httpClient';
import {
  INVENTORY_REASON_VALUES,
  type InventoryAdjustmentInput,
  type InventoryAlert,
  type InventoryLog,
  type InventoryReason,
  type InventoryVariantCreateInput,
  type InventoryVariantUpdateInput,
  type ProductVariant,
} from './types';

const inventoryReasonSet = new Set<string>(INVENTORY_REASON_VALUES);

function normalizeReason(reason: string): InventoryReason {
  return inventoryReasonSet.has(reason) ? (reason as InventoryReason) : 'manual_adjustment';
}

type VariantPayload =
  | { variant: ProductVariant }
  | (ProductVariant & { productId?: string; productTitle?: string });

type VariantResponse = VariantPayload | { data: VariantPayload };

type LowStockPayload = InventoryAlert[] | { alerts: InventoryAlert[] };

type LowStockResponse = LowStockPayload | { data: LowStockPayload };

type HistoryPayload = InventoryLog[] | { history: InventoryLog[] };

type HistoryResponse = HistoryPayload | { data: HistoryPayload };

function normalizeVariant(variant: ProductVariant): ProductVariant {
  return {
    ...variant,
    sku: String(variant.sku ?? '').trim(),
    name: String(variant.name ?? ''),
    stock: Number(variant.stock ?? 0),
    lowStockThreshold: Number(variant.lowStockThreshold ?? 0),
    isDefault: Boolean(variant.isDefault),
  };
}

function normalizeAlerts(payload: LowStockPayload): InventoryAlert[] {
  const alerts = Array.isArray(payload) ? payload : payload.alerts;
  const list = Array.isArray(alerts) ? alerts : [];
  return list.map((alert) => ({
    ...alert,
    stock: Number(alert.stock ?? 0),
    lowStockThreshold: Number(alert.lowStockThreshold ?? 0),
  }));
}

function normalizeHistory(payload: HistoryPayload): InventoryLog[] {
  const history = Array.isArray(payload) ? payload : payload.history;
  const list = Array.isArray(history) ? history : [];

  return list.map((entry) => ({
    ...entry,
    change: Number(entry.change ?? 0),
    stockBefore: Number(entry.stockBefore ?? 0),
    stockAfter: Number(entry.stockAfter ?? 0),
    reason: normalizeReason(String(entry.reason ?? 'manual_adjustment')),
    createdAt: (() => {
      const parsed = new Date(entry.createdAt);
      return Number.isNaN(parsed.getTime()) ? String(entry.createdAt ?? '') : parsed.toISOString();
    })(),
  }));
}

function normalizeVariantResponse(payload: VariantPayload): ProductVariant {
  const variant = 'variant' in payload ? payload.variant : payload;
  return normalizeVariant(variant);
}

export async function createVariant(payload: InventoryVariantCreateInput): Promise<ProductVariant> {
  const response = await httpRequest<VariantResponse>('/api/inventory/variants', {
    method: 'POST',
    body: payload,
  });

  return normalizeVariantResponse(unwrapData<VariantPayload>(response));
}

export async function updateVariant(variantId: string, payload: InventoryVariantUpdateInput): Promise<ProductVariant> {
  const response = await httpRequest<VariantResponse>(`/api/inventory/variants/${variantId}`, {
    method: 'PATCH',
    body: payload,
  });

  return normalizeVariantResponse(unwrapData<VariantPayload>(response));
}

export async function adjustInventory(payload: InventoryAdjustmentInput): Promise<ProductVariant> {
  const response = await httpRequest<VariantResponse>('/api/inventory/adjustments', {
    method: 'POST',
    body: payload,
  });

  return normalizeVariantResponse(unwrapData<VariantPayload>(response));
}

export async function getLowStockAlerts(threshold?: number): Promise<InventoryAlert[]> {
  const query = new URLSearchParams();
  if (typeof threshold === 'number' && Number.isFinite(threshold)) {
    query.set('threshold', String(Math.max(threshold, 0)));
  }

  const queryString = query.toString();
  const path = queryString ? `/api/inventory/low-stock?${queryString}` : '/api/inventory/low-stock';
  const response = await httpRequest<LowStockResponse>(path, { method: 'GET' });
  return normalizeAlerts(unwrapData<LowStockPayload>(response));
}

export async function getInventoryHistory(options: {
  limit?: number;
  productId?: string;
  variantId?: string;
  sku?: string;
} = {}): Promise<InventoryLog[]> {
  const query = new URLSearchParams();

  if (typeof options.limit === 'number' && Number.isFinite(options.limit)) {
    query.set('limit', String(Math.max(1, Math.min(Math.floor(options.limit), 200))));
  }

  if (options.productId) {
    query.set('productId', options.productId);
  }

  if (options.variantId) {
    query.set('variantId', options.variantId);
  }

  if (options.sku) {
    query.set('sku', options.sku);
  }

  const queryString = query.toString();
  const path = queryString ? `/api/inventory/history?${queryString}` : '/api/inventory/history';
  const response = await httpRequest<HistoryResponse>(path, { method: 'GET' });
  return normalizeHistory(unwrapData<HistoryPayload>(response));
}
