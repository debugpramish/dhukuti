import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createFinanceExpense,
  createPayoutSettlement,
  deleteFinanceExpense,
  getFinanceExpenses,
  getFinancePayouts,
  getFinanceSummary,
  updatePayoutSettlement,
} from '@/services/api/financeApi';
import {
  FINANCE_EXPENSE_CATEGORY_VALUES,
  PAYOUT_PROVIDER_VALUES,
  PAYOUT_SETTLEMENT_STATUS_VALUES,
  type FinanceExpenseCategory,
  type PayoutProvider,
  type PayoutSettlement,
  type PayoutSettlementStatus,
} from '@/services/api/types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'NPR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatExpenseCategory(value: FinanceExpenseCategory): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatProvider(provider: PayoutProvider): string {
  if (provider === 'esewa') {
    return 'eSewa';
  }
  if (provider === 'khalti') {
    return 'Khalti';
  }
  return 'COD';
}

function statusBadgeVariant(status: PayoutSettlementStatus): 'warning' | 'success' | 'destructive' {
  if (status === 'settled') {
    return 'success';
  }
  if (status === 'failed') {
    return 'destructive';
  }
  return 'warning';
}

export default function FinancePage() {
  const queryClient = useQueryClient();
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<FinanceExpenseCategory>('operations');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseNote, setExpenseNote] = useState('');

  const [settlementProvider, setSettlementProvider] = useState<PayoutProvider>('esewa');
  const [settlementGrossAmount, setSettlementGrossAmount] = useState('');
  const [settlementFeeAmount, setSettlementFeeAmount] = useState('');
  const [settlementStatus, setSettlementStatus] = useState<PayoutSettlementStatus>('pending');
  const [settlementReference, setSettlementReference] = useState('');
  const [settlementGatewayName, setSettlementGatewayName] = useState('');
  const [settlementDate, setSettlementDate] = useState('');
  const [settlementNote, setSettlementNote] = useState('');

  const filters = useMemo(
    () => ({
      dateFrom,
      dateTo,
      limit: 120,
    }),
    [dateFrom, dateTo],
  );

  const summaryQuery = useQuery({
    queryKey: ['finance-summary', filters],
    queryFn: () => getFinanceSummary(filters),
    retry: 1,
  });

  const expensesQuery = useQuery({
    queryKey: ['finance-expenses', filters],
    queryFn: () => getFinanceExpenses(filters),
    retry: 1,
  });

  const payoutsQuery = useQuery({
    queryKey: ['finance-payouts', filters],
    queryFn: () => getFinancePayouts(filters),
    retry: 1,
  });

  const createExpenseMutation = useMutation({
    mutationFn: createFinanceExpense,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finance-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-expenses'] }),
      ]);
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => deleteFinanceExpense(expenseId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finance-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['finance-expenses'] }),
      ]);
    },
  });

  const createSettlementMutation = useMutation({
    mutationFn: createPayoutSettlement,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finance-payouts'] }),
      ]);
    },
  });

  const updateSettlementMutation = useMutation({
    mutationFn: ({ settlementId, payload }: { settlementId: string; payload: Parameters<typeof updatePayoutSettlement>[1] }) =>
      updatePayoutSettlement(settlementId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finance-payouts'] }),
      ]);
    },
  });

  const updateSettlementId = updateSettlementMutation.isPending ? updateSettlementMutation.variables?.settlementId : null;
  const deletingExpenseId = deleteExpenseMutation.isPending ? deleteExpenseMutation.variables : null;

  const applyDateFilter = () => {
    setErrorMessage(null);
    setFeedback(null);

    if (dateFromInput && dateToInput && dateFromInput > dateToInput) {
      setErrorMessage('Start date must be before or equal to end date.');
      return;
    }

    setDateFrom(dateFromInput ? new Date(dateFromInput).toISOString() : undefined);
    setDateTo(dateToInput ? new Date(dateToInput).toISOString() : undefined);
  };

  const clearDateFilter = () => {
    setDateFromInput('');
    setDateToInput('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setErrorMessage(null);
    setFeedback(null);
  };

  const handleCreateExpense = async () => {
    setErrorMessage(null);
    setFeedback(null);

    const amount = Number(expenseAmount);
    if (!expenseTitle.trim()) {
      setErrorMessage('Expense title is required.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setErrorMessage('Expense amount must be a non-negative number.');
      return;
    }
    if (!expenseDate) {
      setErrorMessage('Expense date is required.');
      return;
    }

    try {
      await createExpenseMutation.mutateAsync({
        title: expenseTitle.trim(),
        category: expenseCategory,
        amount,
        incurredAt: new Date(expenseDate).toISOString(),
        note: expenseNote.trim() || undefined,
      });

      setExpenseTitle('');
      setExpenseCategory('operations');
      setExpenseAmount('');
      setExpenseDate('');
      setExpenseNote('');
      setFeedback('Expense added successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to add expense');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    setErrorMessage(null);
    setFeedback(null);

    try {
      await deleteExpenseMutation.mutateAsync(expenseId);
      setFeedback('Expense deleted successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete expense');
    }
  };

  const handleCreateSettlement = async () => {
    setErrorMessage(null);
    setFeedback(null);

    const grossAmount = Number(settlementGrossAmount);
    const feeAmount = settlementFeeAmount ? Number(settlementFeeAmount) : 0;
    if (!Number.isFinite(grossAmount) || grossAmount < 0) {
      setErrorMessage('Settlement gross amount must be a non-negative number.');
      return;
    }
    if (!Number.isFinite(feeAmount) || feeAmount < 0) {
      setErrorMessage('Settlement fee amount must be a non-negative number.');
      return;
    }
    if (feeAmount > grossAmount) {
      setErrorMessage('Fee amount cannot exceed gross amount.');
      return;
    }

    try {
      await createSettlementMutation.mutateAsync({
        provider: settlementProvider,
        grossAmount,
        feeAmount,
        status: settlementStatus,
        settlementReference: settlementReference.trim() || undefined,
        gatewayName: settlementGatewayName.trim() || undefined,
        settlementDate: settlementDate ? new Date(settlementDate).toISOString() : undefined,
        reconciliationNote: settlementNote.trim() || undefined,
      });

      setSettlementProvider('esewa');
      setSettlementGrossAmount('');
      setSettlementFeeAmount('');
      setSettlementStatus('pending');
      setSettlementReference('');
      setSettlementGatewayName('');
      setSettlementDate('');
      setSettlementNote('');
      setFeedback('Payout settlement saved.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save settlement');
    }
  };

  const handleSettlementStatusChange = async (settlement: PayoutSettlement, status: PayoutSettlementStatus) => {
    setErrorMessage(null);
    setFeedback(null);

    try {
      await updateSettlementMutation.mutateAsync({
        settlementId: settlement.id,
        payload: {
          status,
          settlementDate:
            status === 'settled' && !settlement.settlementDate ? new Date().toISOString() : settlement.settlementDate,
        },
      });
      setFeedback(`Settlement ${status}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update settlement');
    }
  };

  const handleToggleReconcile = async (settlement: PayoutSettlement) => {
    setErrorMessage(null);
    setFeedback(null);

    try {
      await updateSettlementMutation.mutateAsync({
        settlementId: settlement.id,
        payload: {
          reconciled: !settlement.reconciled,
        },
      });
      setFeedback(settlement.reconciled ? 'Settlement marked unreconciled.' : 'Settlement marked reconciled.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update reconciliation');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Finance</h1>
        <p className="text-sm text-muted-foreground">
          Monitor revenue, expenses, tax impact, and payout reconciliation in one place.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Date Filter</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="finance-date-from">From</label>
              <Input
                id="finance-date-from"
                type="date"
                value={dateFromInput}
                onChange={(event) => setDateFromInput(event.target.value)}
                className="h-10 w-44"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="finance-date-to">To</label>
              <Input
                id="finance-date-to"
                type="date"
                value={dateToInput}
                onChange={(event) => setDateToInput(event.target.value)}
                className="h-10 w-44"
              />
            </div>
            <Button type="button" onClick={applyDateFilter}>Apply</Button>
            <Button type="button" variant="outline" onClick={clearDateFilter}>Clear</Button>
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Gross Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summaryQuery.data ? formatCurrency(summaryQuery.data.grossRevenue) : '--'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Net Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summaryQuery.data ? formatCurrency(summaryQuery.data.netRevenue) : '--'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summaryQuery.data ? formatCurrency(summaryQuery.data.totalExpenses) : '--'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Net Profit</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summaryQuery.data ? formatCurrency(summaryQuery.data.netProfit) : '--'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">VAT / Tax</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">
              {summaryQuery.data ? formatCurrency(summaryQuery.data.vatAmount) : '--'}
            </p>
            <p className="text-muted-foreground">
              Rate: {summaryQuery.data ? `${summaryQuery.data.vatRatePercent}%` : '--'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add Expense</CardTitle>
            <p className="text-sm text-muted-foreground">
              Track operational costs to keep net profit and finance summaries accurate.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Expense title"
              value={expenseTitle}
              onChange={(event) => setExpenseTitle(event.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={expenseCategory}
                onChange={(event) => setExpenseCategory(event.target.value as FinanceExpenseCategory)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {FINANCE_EXPENSE_CATEGORY_VALUES.map((category) => (
                  <option key={category} value={category}>
                    {formatExpenseCategory(category)}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
              />
              <Input
                placeholder="Note (optional)"
                value={expenseNote}
                onChange={(event) => setExpenseNote(event.target.value)}
              />
            </div>
            <Button
              type="button"
              onClick={() => void handleCreateExpense()}
              disabled={createExpenseMutation.isPending}
            >
              {createExpenseMutation.isPending ? 'Saving expense...' : 'Save Expense'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <p className="text-sm text-muted-foreground">Real expense entries stored in your finance ledger.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {expensesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading expenses...</p> : null}
            {expensesQuery.isError ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">
                  {expensesQuery.error instanceof Error ? expensesQuery.error.message : 'Request failed'}
                </p>
                <Button type="button" variant="outline" onClick={() => void expensesQuery.refetch()}>
                  Retry
                </Button>
              </div>
            ) : null}
            {!expensesQuery.isLoading && !expensesQuery.isError && expensesQuery.data && expensesQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
            ) : null}
            {!expensesQuery.isLoading && !expensesQuery.isError && expensesQuery.data && expensesQuery.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] table-auto border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Title</th>
                      <th className="px-2 py-2 font-medium">Category</th>
                      <th className="px-2 py-2 font-medium">Amount</th>
                      <th className="px-2 py-2 font-medium">Date</th>
                      <th className="px-2 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expensesQuery.data.map((expense) => (
                      <tr key={expense.id} className="border-b">
                        <td className="px-2 py-2">
                          <p className="font-medium">{expense.title}</p>
                          {expense.note ? <p className="text-xs text-muted-foreground">{expense.note}</p> : null}
                        </td>
                        <td className="px-2 py-2">{formatExpenseCategory(expense.category)}</td>
                        <td className="px-2 py-2 font-medium">{formatCurrency(expense.amount)}</td>
                        <td className="px-2 py-2">{formatDate(expense.incurredAt)}</td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDeleteExpense(expense.id)}
                            disabled={deletingExpenseId === expense.id}
                          >
                            {deletingExpenseId === expense.id ? 'Deleting...' : 'Delete'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payout Tracking</CardTitle>
          <p className="text-sm text-muted-foreground">
            Payment gateway settlements, pending payouts, and reconciliation from real order + settlement data.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {payoutsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading payouts...</p> : null}
          {payoutsQuery.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                {payoutsQuery.error instanceof Error ? payoutsQuery.error.message : 'Request failed'}
              </p>
              <Button type="button" variant="outline" onClick={() => void payoutsQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}

          {payoutsQuery.data ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Expected Receivable</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {formatCurrency(payoutsQuery.data.summary.expectedGross)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Settled Net</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {formatCurrency(payoutsQuery.data.summary.settledNet)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pending Payouts</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {formatCurrency(payoutsQuery.data.summary.pendingPayout)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Reconciliation Gap</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    {formatCurrency(payoutsQuery.data.summary.reconciliationGap)}
                  </CardContent>
                </Card>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[760px] table-auto border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Provider</th>
                      <th className="px-2 py-2 font-medium">Expected</th>
                      <th className="px-2 py-2 font-medium">Settled Gross</th>
                      <th className="px-2 py-2 font-medium">Pending</th>
                      <th className="px-2 py-2 font-medium">Recorded Pending</th>
                      <th className="px-2 py-2 font-medium">Reconciliation Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutsQuery.data.providers.map((provider) => (
                      <tr key={provider.provider} className="border-b">
                        <td className="px-2 py-2 font-medium">{formatProvider(provider.provider)}</td>
                        <td className="px-2 py-2">{formatCurrency(provider.expectedGross)}</td>
                        <td className="px-2 py-2">{formatCurrency(provider.settledGross)}</td>
                        <td className="px-2 py-2">{formatCurrency(provider.pendingPayout)}</td>
                        <td className="px-2 py-2">{formatCurrency(provider.recordedPending)}</td>
                        <td className="px-2 py-2">{formatCurrency(provider.reconciliationGap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Record Settlement</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        value={settlementProvider}
                        onChange={(event) => setSettlementProvider(event.target.value as PayoutProvider)}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {PAYOUT_PROVIDER_VALUES.map((provider) => (
                          <option key={provider} value={provider}>
                            {formatProvider(provider)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={settlementStatus}
                        onChange={(event) => setSettlementStatus(event.target.value as PayoutSettlementStatus)}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {PAYOUT_SETTLEMENT_STATUS_VALUES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Gross amount"
                        value={settlementGrossAmount}
                        onChange={(event) => setSettlementGrossAmount(event.target.value)}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Fee amount"
                        value={settlementFeeAmount}
                        onChange={(event) => setSettlementFeeAmount(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        placeholder="Settlement reference"
                        value={settlementReference}
                        onChange={(event) => setSettlementReference(event.target.value)}
                      />
                      <Input
                        placeholder="Gateway name (optional)"
                        value={settlementGatewayName}
                        onChange={(event) => setSettlementGatewayName(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        type="date"
                        value={settlementDate}
                        onChange={(event) => setSettlementDate(event.target.value)}
                      />
                      <Input
                        placeholder="Reconciliation note"
                        value={settlementNote}
                        onChange={(event) => setSettlementNote(event.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleCreateSettlement()}
                      disabled={createSettlementMutation.isPending}
                    >
                      {createSettlementMutation.isPending ? 'Saving settlement...' : 'Save Settlement'}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Settlement Log</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {payoutsQuery.data.settlements.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No settlements recorded yet.</p>
                    ) : (
                      <div className="max-h-[420px] overflow-auto">
                        <table className="w-full min-w-[700px] table-auto border-collapse text-sm">
                          <thead>
                            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                              <th className="px-2 py-2 font-medium">Provider</th>
                              <th className="px-2 py-2 font-medium">Gross</th>
                              <th className="px-2 py-2 font-medium">Net</th>
                              <th className="px-2 py-2 font-medium">Status</th>
                              <th className="px-2 py-2 font-medium">Reconciled</th>
                              <th className="px-2 py-2 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payoutsQuery.data.settlements.map((settlement) => (
                              <tr key={settlement.id} className="border-b align-top">
                                <td className="px-2 py-2">
                                  <p className="font-medium">{formatProvider(settlement.provider)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {settlement.settlementReference || 'No reference'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {settlement.settlementDate ? formatDate(settlement.settlementDate) : 'No settlement date'}
                                  </p>
                                </td>
                                <td className="px-2 py-2">
                                  <p>{formatCurrency(settlement.grossAmount)}</p>
                                  <p className="text-xs text-muted-foreground">Fee {formatCurrency(settlement.feeAmount)}</p>
                                </td>
                                <td className="px-2 py-2 font-medium">{formatCurrency(settlement.netAmount)}</td>
                                <td className="px-2 py-2">
                                  <Badge variant={statusBadgeVariant(settlement.status)}>{settlement.status}</Badge>
                                </td>
                                <td className="px-2 py-2">
                                  <Badge variant={settlement.reconciled ? 'success' : 'warning'}>
                                    {settlement.reconciled ? 'Yes' : 'No'}
                                  </Badge>
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {settlement.status !== 'settled' ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void handleSettlementStatusChange(settlement, 'settled')}
                                        disabled={updateSettlementId === settlement.id}
                                      >
                                        {updateSettlementId === settlement.id ? 'Updating...' : 'Mark settled'}
                                      </Button>
                                    ) : null}
                                    {settlement.status !== 'failed' ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void handleSettlementStatusChange(settlement, 'failed')}
                                        disabled={updateSettlementId === settlement.id}
                                      >
                                        {updateSettlementId === settlement.id ? 'Updating...' : 'Mark failed'}
                                      </Button>
                                    ) : null}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void handleToggleReconcile(settlement)}
                                      disabled={updateSettlementId === settlement.id}
                                    >
                                      {updateSettlementId === settlement.id
                                        ? 'Updating...'
                                        : settlement.reconciled
                                          ? 'Unreconcile'
                                          : 'Reconcile'}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
