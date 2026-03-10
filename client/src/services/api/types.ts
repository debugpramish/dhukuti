export const PRODUCT_STATUS_VALUES = ['active', 'draft', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUS_VALUES)[number];
export const DISCOUNT_TYPE_VALUES = ['none', 'percentage', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPE_VALUES)[number];
export const COUPON_TYPE_VALUES = ['percentage', 'fixed'] as const;
export type CouponType = (typeof COUPON_TYPE_VALUES)[number];

export const ORDER_STATUS_VALUES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];
export const ORDER_PAYMENT_METHOD_VALUES = ['cod', 'esewa', 'khalti'] as const;
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHOD_VALUES)[number];
export const ORDER_PAYMENT_STATUS_VALUES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUS_VALUES)[number];
export const ORDER_COD_STATUS_VALUES = ['pending', 'collected', 'failed', 'not_applicable'] as const;
export type OrderCodStatus = (typeof ORDER_COD_STATUS_VALUES)[number];
export const SHIPMENT_STATUS_VALUES = [
  'pending',
  'label_generated',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUS_VALUES)[number];
export const STORE_COURIER_VALUES = ['nepal-post', 'pathao', 'delivery-sathi'] as const;
export type StoreCourier = (typeof STORE_COURIER_VALUES)[number];
export const ABANDONED_CHECKOUT_STATUS_VALUES = ['open', 'recovered', 'expired'] as const;
export type AbandonedCheckoutStatus = (typeof ABANDONED_CHECKOUT_STATUS_VALUES)[number];
export const ABANDONED_REMINDER_STATUS_VALUES = ['sent', 'failed', 'simulated'] as const;
export type AbandonedReminderStatus = (typeof ABANDONED_REMINDER_STATUS_VALUES)[number];

export const INVENTORY_REASON_VALUES = ['order', 'manual_adjustment', 'restock', 'correction'] as const;
export type InventoryReason = (typeof INVENTORY_REASON_VALUES)[number];
export const INVENTORY_ADJUSTMENT_TYPE_VALUES = ['set', 'increase', 'decrease'] as const;
export type InventoryAdjustmentType = (typeof INVENTORY_ADJUSTMENT_TYPE_VALUES)[number];

export type DashboardRecentOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
};

export type DashboardSummary = {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  recentOrders: DashboardRecentOrder[];
};

export type DashboardOrderTrendDirection = 'up' | 'down' | 'flat';

export type DashboardOrderTrendPoint = {
  key: string;
  label: string;
  count: number;
};

export type DashboardOrderTrendBucket = {
  current: number;
  previous: number;
  changeCount: number;
  changePercent: number;
  direction: DashboardOrderTrendDirection;
  series: DashboardOrderTrendPoint[];
};

export type DashboardOrderTrends = {
  day: DashboardOrderTrendBucket;
  month: DashboardOrderTrendBucket;
  year: DashboardOrderTrendBucket;
  generatedAt: string;
};

export const REPORT_TYPE_VALUES = [
  'sales',
  'tax',
  'product-performance',
  'inventory-valuation',
  'customers',
] as const;
export type ReportType = (typeof REPORT_TYPE_VALUES)[number];

export const REPORT_EXPORT_FORMAT_VALUES = ['csv', 'excel'] as const;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMAT_VALUES)[number];

export type ReportDateFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export type SalesReportRow = {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  subtotal: number;
  discountTotal: number;
  total: number;
};

export type SalesReport = {
  reportType: 'sales';
  generatedAt: string;
  filters: ReportDateFilters;
  summary: {
    ordersCount: number;
    completedOrders: number;
    cancelledOrders: number;
    grossSales: number;
    discountTotal: number;
    netSales: number;
    averageOrderValue: number;
  };
  rows: SalesReportRow[];
};

export type TaxReportRow = {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  taxableAmount: number;
  taxRatePercent: number;
  estimatedTax: number;
  totalWithTax: number;
};

export type TaxReport = {
  reportType: 'tax';
  generatedAt: string;
  filters: ReportDateFilters;
  summary: {
    taxableOrders: number;
    taxRatePercent: number;
    taxableSales: number;
    estimatedTaxTotal: number;
    grossWithTax: number;
  };
  rows: TaxReportRow[];
};

export type ProductPerformanceReportRow = {
  productTitle: string;
  sku: string;
  variantName: string;
  unitsSold: number;
  orderCount: number;
  revenue: number;
  averageUnitPrice: number;
};

export type ProductPerformanceReport = {
  reportType: 'product-performance';
  generatedAt: string;
  filters: ReportDateFilters;
  summary: {
    uniqueProducts: number;
    totalUnitsSold: number;
    totalRevenue: number;
    averageRevenuePerProduct: number;
  };
  rows: ProductPerformanceReportRow[];
};

export type InventoryValuationReportRow = {
  productTitle: string;
  sku: string;
  variantName: string;
  productStatus: ProductStatus;
  stock: number;
  lowStockThreshold: number;
  unitPrice: number;
  valuation: number;
  lowStock: boolean;
};

export type InventoryValuationReport = {
  reportType: 'inventory-valuation';
  generatedAt: string;
  summary: {
    skuCount: number;
    totalUnitsInStock: number;
    lowStockSkuCount: number;
    totalInventoryValue: number;
  };
  rows: InventoryValuationReportRow[];
};

export type CustomerReportRow = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerLocation: string;
  ordersCount: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  itemsPurchased: number;
  firstOrderAt: string;
  lastOrderAt: string;
};

export type CustomerReport = {
  reportType: 'customers';
  generatedAt: string;
  filters: ReportDateFilters;
  summary: {
    customerCount: number;
    totalOrders: number;
    activeCustomers: number;
    returningCustomers: number;
    totalRevenue: number;
  };
  rows: CustomerReportRow[];
};

export type DashboardReportPayload =
  | SalesReport
  | TaxReport
  | ProductPerformanceReport
  | InventoryValuationReport
  | CustomerReport;

export type Product = {
  id: string;
  title: string;
  category: string;
  price: number;
  discountType: DiscountType;
  discountValue: number;
  discountedPrice: number;
  discountAmount: number;
  hasDiscount: boolean;
  imageUrl: string;
  status: ProductStatus;
  isFeatured: boolean;
  isTrending: boolean;
  isBestSeller: boolean;
  variants: ProductVariant[];
};

export type ProductVariant = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
  isDefault: boolean;
};

export type ProductCreateInput = {
  title: string;
  category?: string;
  price: number;
  discountType: DiscountType;
  discountValue: number;
  status: ProductStatus;
  imageFile?: File;
  isFeatured?: boolean;
  isTrending?: boolean;
  isBestSeller?: boolean;
  stock?: number;
  lowStockThreshold?: number;
};

export type ProductUpdateInput = {
  price: number;
  discountType: DiscountType;
  discountValue: number;
  imageFile?: File;
};

export type InventoryVariantCreateInput = {
  productId: string;
  sku: string;
  name?: string;
  stock?: number;
  lowStockThreshold?: number;
  isDefault?: boolean;
};

export type InventoryVariantUpdateInput = {
  sku?: string;
  name?: string;
  lowStockThreshold?: number;
  isDefault?: boolean;
};

export type InventoryAdjustmentInput = {
  productId: string;
  variantId: string;
  adjustmentType: InventoryAdjustmentType;
  quantity: number;
  reason: InventoryReason;
  note?: string;
};

export type InventoryAlert = {
  productId: string;
  productTitle: string;
  variantId: string;
  sku: string;
  variantName: string;
  stock: number;
  lowStockThreshold: number;
};

export type InventoryLog = {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  change: number;
  stockBefore: number;
  stockAfter: number;
  reason: InventoryReason;
  note?: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
};

export type Coupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CouponCreateInput = {
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  isActive: boolean;
  usageLimit?: number;
  expiresAt?: string;
};

export type CouponUpdateInput = CouponCreateInput;

export type OrderItem = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number;
  sku?: string;
  variantName?: string;
};

export type ShipmentHistoryEntry = {
  status: ShipmentStatus;
  timestamp: string;
  note?: string;
};

export type OrderShipment = {
  courier: string;
  trackingNumber: string;
  labelUrl: string;
  status: ShipmentStatus;
  estimatedDeliveryAt?: string;
  lastUpdatedAt?: string;
  history: ShipmentHistoryEntry[];
};

export type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerLocation: string;
  trafficSource?: string;
  subtotal: number;
  productDiscountTotal: number;
  couponCode?: string;
  couponDiscountTotal: number;
  discountTotal: number;
  shippingFee: number;
  codFee: number;
  total: number;
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  paymentReference?: string;
  codStatus: OrderCodStatus;
  codCollectedAmount: number;
  shipment: OrderShipment | null;
  createdAt: string;
  items: OrderItem[];
};

export type CheckoutBill = Pick<
  Order,
  | 'subtotal'
  | 'productDiscountTotal'
  | 'couponCode'
  | 'couponDiscountTotal'
  | 'discountTotal'
  | 'shippingFee'
  | 'codFee'
  | 'paymentMethod'
  | 'total'
>;

export type ShippingRules = {
  baseFee: number;
  freeShippingAbove: number;
  codEnabled: boolean;
  codFee: number;
  defaultCourier: StoreCourier;
  supportedCouriers: StoreCourier[];
};

export type StoreSettings = {
  slug: string;
  name: string;
  description: string;
  phone: string;
  address: string;
  logoUrl?: string;
  shippingRules: ShippingRules;
};

export type StoreSettingsUpdateInput = Pick<StoreSettings, 'name' | 'description' | 'phone' | 'address'>;

export type PublicStore = StoreSettings;

export type StoreContactInput = {
  name: string;
  email: string;
  message: string;
};

export type FulfillmentOrder = Order;

export type FulfillmentShipmentInput = {
  courier?: StoreCourier;
  note?: string;
};

export type FulfillmentShipmentStatusInput = {
  status: ShipmentStatus;
  note?: string;
};

export type FulfillmentCodInput = {
  codStatus: OrderCodStatus;
  collectedAmount?: number;
  note?: string;
};

export type CourierOption = {
  id: StoreCourier;
  name: string;
  supportsCod: boolean;
};

export type CourierQuote = {
  courier: StoreCourier;
  destination: string;
  estimatedFee: number;
  estimatedDays: number;
};

export type DummyPaymentProvider = Extract<OrderPaymentMethod, 'esewa' | 'khalti'>;

export type DummyPayment = {
  provider: DummyPaymentProvider;
  paymentSessionId: string;
  status: 'initiated' | 'verified';
  amount: number;
  paymentReference?: string;
  expiresAt: string;
  gatewayPayload?: Record<string, unknown>;
};

export type AbandonedCheckoutItem = {
  title: string;
  quantity: number;
  unitPrice: number;
  sku?: string;
  variantName?: string;
};

export type AbandonedCheckout = {
  id: string;
  storeSlug: string;
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
  status: AbandonedCheckoutStatus;
  source: 'preview' | 'payment_initiated';
  reminderCount: number;
  autoReminderCount: number;
  lastReminderSentAt?: string;
  lastReminderStatus?: AbandonedReminderStatus;
  lastReminderMessage?: string;
  lastActivityAt: string;
  recoveredAt?: string;
  createdAt: string;
  updatedAt: string;
  items: AbandonedCheckoutItem[];
};

export type AbandonedCartAnalytics = {
  totalCaptured: number;
  abandonedCount: number;
  recoveredCount: number;
  recoveryRatePercent: number;
  potentialRevenue: number;
  recoveredRevenue: number;
  revenueRecovered: number;
  remindersSent: number;
  autoRemindersSent: number;
  thresholdMinutes: number;
};

export type AbandonedCartAutoReminderResult = {
  scanned: number;
  sent: number;
  simulated: number;
  failed: number;
};

export const FINANCE_EXPENSE_CATEGORY_VALUES = ['operations', 'marketing', 'salary', 'logistics', 'other'] as const;
export type FinanceExpenseCategory = (typeof FINANCE_EXPENSE_CATEGORY_VALUES)[number];

export const PAYOUT_PROVIDER_VALUES = ['esewa', 'khalti', 'cod'] as const;
export type PayoutProvider = (typeof PAYOUT_PROVIDER_VALUES)[number];

export const PAYOUT_SETTLEMENT_STATUS_VALUES = ['pending', 'settled', 'failed'] as const;
export type PayoutSettlementStatus = (typeof PAYOUT_SETTLEMENT_STATUS_VALUES)[number];

export type FinanceSummary = {
  grossRevenue: number;
  netRevenue: number;
  totalDiscounts: number;
  totalExpenses: number;
  netProfit: number;
  orderCount: number;
  expenseCount: number;
  vatTaxableAmount: number;
  vatRatePercent: number;
  vatAmount: number;
  revenueExcludingVat: number;
  dateFrom?: string;
  dateTo?: string;
};

export type FinanceExpense = {
  id: string;
  title: string;
  category: FinanceExpenseCategory;
  amount: number;
  note?: string;
  incurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type FinanceExpenseCreateInput = {
  title: string;
  category: FinanceExpenseCategory;
  amount: number;
  note?: string;
  incurredAt: string;
};

export type FinanceExpenseUpdateInput = Partial<FinanceExpenseCreateInput>;

export type PayoutSettlement = {
  id: string;
  provider: PayoutProvider;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  status: PayoutSettlementStatus;
  settlementReference?: string;
  gatewayName?: string;
  settlementDate?: string;
  reconciled: boolean;
  reconciledAt?: string;
  reconciliationNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type PayoutSettlementCreateInput = {
  provider: PayoutProvider;
  grossAmount: number;
  feeAmount: number;
  status?: PayoutSettlementStatus;
  settlementReference?: string;
  gatewayName?: string;
  settlementDate?: string;
  reconciliationNote?: string;
};

export type PayoutSettlementUpdateInput = Partial<
  Pick<
    PayoutSettlement,
    'grossAmount' | 'feeAmount' | 'status' | 'settlementReference' | 'gatewayName' | 'settlementDate' | 'reconciled' | 'reconciliationNote'
  >
>;

export type FinanceProviderPayout = {
  provider: PayoutProvider;
  expectedGross: number;
  settledGross: number;
  settledNet: number;
  settlementFees: number;
  pendingPayout: number;
  recordedPending: number;
  reconciliationGap: number;
  expectedOrders: number;
};

export type FinancePayoutSummary = {
  expectedGross: number;
  settledGross: number;
  settledNet: number;
  settlementFees: number;
  pendingPayout: number;
  recordedPending: number;
  reconciliationGap: number;
};

export type FinancePayouts = {
  providers: FinanceProviderPayout[];
  summary: FinancePayoutSummary;
  settlements: PayoutSettlement[];
  dateFrom?: string;
  dateTo?: string;
};

export const STORE_ANALYTICS_EVENT_TYPE_VALUES = ['store_visit', 'product_view', 'checkout_started'] as const;
export type StoreAnalyticsEventType = (typeof STORE_ANALYTICS_EVENT_TYPE_VALUES)[number];

export type StoreAnalyticsEventInput = {
  eventType: StoreAnalyticsEventType;
  productId?: string;
  sku?: string;
};

export type SalesRevenueTrendPoint = {
  date: string;
  revenue: number;
  orders: number;
  unitsSold: number;
};

export type SalesRevenueByProduct = {
  productId?: string;
  title: string;
  category: string;
  revenue: number;
  unitsSold: number;
  ordersCount: number;
};

export type SalesRevenueByCategory = {
  category: string;
  revenue: number;
  unitsSold: number;
  ordersCount: number;
};

export type SalesRevenueByTrafficSource = {
  source: string;
  revenue: number;
  ordersCount: number;
  averageOrderValue: number;
};

export type SalesAnalytics = {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    totalUnitsSold: number;
    averageOrderValue: number;
  };
  revenueTrend: SalesRevenueTrendPoint[];
  revenueByProduct: SalesRevenueByProduct[];
  revenueByCategory: SalesRevenueByCategory[];
  revenueByTrafficSource: SalesRevenueByTrafficSource[];
  filters: ReportDateFilters;
};

export type CustomerAnalyticsLtvRow = {
  customerKey: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerLocation: string;
  totalSpent: number;
  ordersCount: number;
  averageOrderValue: number;
  firstOrderAt: string;
  lastOrderAt: string;
};

export type CustomerAnalyticsCohortRetentionPoint = {
  monthOffset: number;
  customers: number;
  ratePercent: number;
};

export type CustomerAnalyticsCohortRow = {
  cohort: string;
  label: string;
  size: number;
  retention: CustomerAnalyticsCohortRetentionPoint[];
};

export type CustomerAnalyticsGeographyRow = {
  location: string;
  customers: number;
  orders: number;
  revenue: number;
};

export type CustomerAnalytics = {
  summary: {
    activeCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    averageLtv: number;
    totalLtvRevenue: number;
  };
  ltv: CustomerAnalyticsLtvRow[];
  cohorts: CustomerAnalyticsCohortRow[];
  geography: CustomerAnalyticsGeographyRow[];
  filters: ReportDateFilters;
};

export type ProductConversionAnalyticsRow = {
  productId: string;
  title: string;
  category: string;
  viewEvents: number;
  uniqueViewers: number;
  purchaseOrders: number;
  unitsSold: number;
  conversionRatePercent: number;
  viewToPurchaseRatio: number;
  revenue: number;
  estimatedProfit: number;
};

export type ProductSkuProfitRow = {
  sku: string;
  title: string;
  category: string;
  unitsSold: number;
  revenue: number;
  estimatedCost: number;
  estimatedProfit: number;
  profitMarginPercent: number;
};

export type ProductAnalytics = {
  summary: {
    trackedProducts: number;
    viewEvents: number;
    purchaseOrders: number;
    conversionRatePercent: number;
    totalRevenue: number;
    totalEstimatedProfit: number;
    defaultCostRatioPercent: number;
  };
  conversion: ProductConversionAnalyticsRow[];
  profitBySku: ProductSkuProfitRow[];
  filters: ReportDateFilters;
};
