import { httpRequest, unwrapData } from './httpClient';
import {
  FINANCE_EXPENSE_CATEGORY_VALUES,
  PAYOUT_PROVIDER_VALUES,
  PAYOUT_SETTLEMENT_STATUS_VALUES,
  type FinanceExpense,
  type FinanceExpenseCategory,
  type FinanceExpenseCreateInput,
  type FinanceExpenseUpdateInput,
  type FinancePayouts,
  type FinanceSummary,
  type PayoutProvider,
  type PayoutSettlement,
  type PayoutSettlementCreateInput,
  type PayoutSettlementStatus,
  type PayoutSettlementUpdateInput,
} from './types';

type DateFilters = {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

type SummaryPayload = FinanceSummary | { summary: FinanceSummary };
type SummaryResponse = SummaryPayload | { data: SummaryPayload };

type ExpensesPayload = FinanceExpense[] | { expenses: FinanceExpense[] };
type ExpensesResponse = ExpensesPayload | { data: ExpensesPayload };

type ExpensePayload = FinanceExpense | { expense: FinanceExpense };
type ExpenseResponse = ExpensePayload | { data: ExpensePayload };

type DeleteExpensePayload = { message: string; expenseId: string };
type DeleteExpenseResponse = DeleteExpensePayload | { data: DeleteExpensePayload };

type PayoutsPayload = FinancePayouts | { payouts: FinancePayouts };
type PayoutsResponse = PayoutsPayload | { data: PayoutsPayload };

type SettlementPayload = PayoutSettlement | { settlement: PayoutSettlement };
type SettlementResponse = SettlementPayload | { data: SettlementPayload };

const expenseCategorySet = new Set<string>(FINANCE_EXPENSE_CATEGORY_VALUES);
const payoutProviderSet = new Set<string>(PAYOUT_PROVIDER_VALUES);
const payoutStatusSet = new Set<string>(PAYOUT_SETTLEMENT_STATUS_VALUES);

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoDate(value: unknown): string {
  const parsed = new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizeExpenseCategory(value: unknown): FinanceExpenseCategory {
  const normalized = String(value ?? '').toLowerCase();
  return expenseCategorySet.has(normalized) ? (normalized as FinanceExpenseCategory) : 'other';
}

function normalizePayoutProvider(value: unknown): PayoutProvider {
  const normalized = String(value ?? '').toLowerCase();
  return payoutProviderSet.has(normalized) ? (normalized as PayoutProvider) : 'esewa';
}

function normalizePayoutStatus(value: unknown): PayoutSettlementStatus {
  const normalized = String(value ?? '').toLowerCase();
  return payoutStatusSet.has(normalized) ? (normalized as PayoutSettlementStatus) : 'pending';
}

function normalizeSummary(payload: SummaryPayload): FinanceSummary {
  const summary = 'summary' in payload ? payload.summary : payload;
  return {
    grossRevenue: toNumber(summary.grossRevenue),
    netRevenue: toNumber(summary.netRevenue),
    totalDiscounts: toNumber(summary.totalDiscounts),
    totalExpenses: toNumber(summary.totalExpenses),
    netProfit: toNumber(summary.netProfit),
    orderCount: toNumber(summary.orderCount),
    expenseCount: toNumber(summary.expenseCount),
    vatTaxableAmount: toNumber(summary.vatTaxableAmount),
    vatRatePercent: toNumber(summary.vatRatePercent),
    vatAmount: toNumber(summary.vatAmount),
    revenueExcludingVat: toNumber(summary.revenueExcludingVat),
    dateFrom: summary.dateFrom ? toIsoDate(summary.dateFrom) : undefined,
    dateTo: summary.dateTo ? toIsoDate(summary.dateTo) : undefined,
  };
}

function normalizeExpense(expense: FinanceExpense): FinanceExpense {
  return {
    id: String(expense.id ?? ''),
    title: String(expense.title ?? ''),
    category: normalizeExpenseCategory(expense.category),
    amount: toNumber(expense.amount),
    note: expense.note ? String(expense.note) : undefined,
    incurredAt: toIsoDate(expense.incurredAt),
    createdAt: toIsoDate(expense.createdAt),
    updatedAt: toIsoDate(expense.updatedAt),
  };
}

function normalizeExpenses(payload: ExpensesPayload): FinanceExpense[] {
  const expenses = Array.isArray(payload) ? payload : payload.expenses;
  const list = Array.isArray(expenses) ? expenses : [];
  return list.map(normalizeExpense);
}

function normalizeSingleExpense(payload: ExpensePayload): FinanceExpense {
  const expense = 'expense' in payload ? payload.expense : payload;
  return normalizeExpense(expense);
}

function normalizeSettlement(settlement: PayoutSettlement): PayoutSettlement {
  return {
    id: String(settlement.id ?? ''),
    provider: normalizePayoutProvider(settlement.provider),
    grossAmount: toNumber(settlement.grossAmount),
    feeAmount: toNumber(settlement.feeAmount),
    netAmount: toNumber(settlement.netAmount),
    status: normalizePayoutStatus(settlement.status),
    settlementReference: settlement.settlementReference ? String(settlement.settlementReference) : undefined,
    gatewayName: settlement.gatewayName ? String(settlement.gatewayName) : undefined,
    settlementDate: settlement.settlementDate ? toIsoDate(settlement.settlementDate) : undefined,
    reconciled: Boolean(settlement.reconciled),
    reconciledAt: settlement.reconciledAt ? toIsoDate(settlement.reconciledAt) : undefined,
    reconciliationNote: settlement.reconciliationNote ? String(settlement.reconciliationNote) : undefined,
    createdAt: toIsoDate(settlement.createdAt),
    updatedAt: toIsoDate(settlement.updatedAt),
  };
}

function normalizePayouts(payload: PayoutsPayload): FinancePayouts {
  const payouts = 'payouts' in payload ? payload.payouts : payload;

  const providers = Array.isArray(payouts.providers) ? payouts.providers : [];
  const settlements = Array.isArray(payouts.settlements) ? payouts.settlements : [];

  return {
    providers: providers.map((entry) => ({
      provider: normalizePayoutProvider(entry.provider),
      expectedGross: toNumber(entry.expectedGross),
      settledGross: toNumber(entry.settledGross),
      settledNet: toNumber(entry.settledNet),
      settlementFees: toNumber(entry.settlementFees),
      pendingPayout: toNumber(entry.pendingPayout),
      recordedPending: toNumber(entry.recordedPending),
      reconciliationGap: toNumber(entry.reconciliationGap),
      expectedOrders: toNumber(entry.expectedOrders),
    })),
    summary: {
      expectedGross: toNumber(payouts.summary?.expectedGross),
      settledGross: toNumber(payouts.summary?.settledGross),
      settledNet: toNumber(payouts.summary?.settledNet),
      settlementFees: toNumber(payouts.summary?.settlementFees),
      pendingPayout: toNumber(payouts.summary?.pendingPayout),
      recordedPending: toNumber(payouts.summary?.recordedPending),
      reconciliationGap: toNumber(payouts.summary?.reconciliationGap),
    },
    settlements: settlements.map(normalizeSettlement),
    dateFrom: payouts.dateFrom ? toIsoDate(payouts.dateFrom) : undefined,
    dateTo: payouts.dateTo ? toIsoDate(payouts.dateTo) : undefined,
  };
}

function normalizeSingleSettlement(payload: SettlementPayload): PayoutSettlement {
  const settlement = 'settlement' in payload ? payload.settlement : payload;
  return normalizeSettlement(settlement);
}

function buildQuery(filters: DateFilters = {}): string {
  const query = new URLSearchParams();
  if (filters.dateFrom) {
    query.set('dateFrom', filters.dateFrom);
  }
  if (filters.dateTo) {
    query.set('dateTo', filters.dateTo);
  }
  if (typeof filters.limit === 'number' && Number.isFinite(filters.limit)) {
    query.set('limit', String(Math.max(1, Math.floor(filters.limit))));
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export async function getFinanceSummary(filters: DateFilters = {}): Promise<FinanceSummary> {
  const response = await httpRequest<SummaryResponse>(`/api/finance/summary${buildQuery(filters)}`, {
    method: 'GET',
  });

  return normalizeSummary(unwrapData<SummaryPayload>(response));
}

export async function getFinanceExpenses(filters: DateFilters = {}): Promise<FinanceExpense[]> {
  const response = await httpRequest<ExpensesResponse>(`/api/finance/expenses${buildQuery(filters)}`, {
    method: 'GET',
  });

  return normalizeExpenses(unwrapData<ExpensesPayload>(response));
}

export async function createFinanceExpense(payload: FinanceExpenseCreateInput): Promise<FinanceExpense> {
  const response = await httpRequest<ExpenseResponse>('/api/finance/expenses', {
    method: 'POST',
    body: payload,
  });

  return normalizeSingleExpense(unwrapData<ExpensePayload>(response));
}

export async function updateFinanceExpense(expenseId: string, payload: FinanceExpenseUpdateInput): Promise<FinanceExpense> {
  const response = await httpRequest<ExpenseResponse>(`/api/finance/expenses/${expenseId}`, {
    method: 'PATCH',
    body: payload,
  });

  return normalizeSingleExpense(unwrapData<ExpensePayload>(response));
}

export async function deleteFinanceExpense(expenseId: string): Promise<DeleteExpensePayload> {
  const response = await httpRequest<DeleteExpenseResponse>(`/api/finance/expenses/${expenseId}`, {
    method: 'DELETE',
  });

  return unwrapData<DeleteExpensePayload>(response);
}

export async function getFinancePayouts(filters: DateFilters = {}): Promise<FinancePayouts> {
  const response = await httpRequest<PayoutsResponse>(`/api/finance/payouts${buildQuery(filters)}`, {
    method: 'GET',
  });

  return normalizePayouts(unwrapData<PayoutsPayload>(response));
}

export async function createPayoutSettlement(payload: PayoutSettlementCreateInput): Promise<PayoutSettlement> {
  const response = await httpRequest<SettlementResponse>('/api/finance/payouts/settlements', {
    method: 'POST',
    body: payload,
  });

  return normalizeSingleSettlement(unwrapData<SettlementPayload>(response));
}

export async function updatePayoutSettlement(
  settlementId: string,
  payload: PayoutSettlementUpdateInput,
): Promise<PayoutSettlement> {
  const response = await httpRequest<SettlementResponse>(`/api/finance/payouts/settlements/${settlementId}`, {
    method: 'PATCH',
    body: payload,
  });

  return normalizeSingleSettlement(unwrapData<SettlementPayload>(response));
}
