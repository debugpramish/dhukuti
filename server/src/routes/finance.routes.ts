import express from 'express';
import mongoose from 'mongoose';

import FinanceExpenseModel from '../models/finance-expense.model';
import OrderModel from '../models/order.model';
import PayoutSettlementModel, { PAYOUT_PROVIDER_VALUES } from '../models/payout-settlement.model';
import { requireAuth, requireMerchant } from '../middleware/auth.middleware';
import { ensureMerchantDemoData } from '../services/merchant-data.service';
import {
  createFinanceExpenseSchema,
  createPayoutSettlementSchema,
  financeDateRangeQuerySchema,
  updateFinanceExpenseSchema,
  updatePayoutSettlementSchema,
} from '../validation/finance.validation';

const financeRouter = express.Router();

type DateRange = {
  dateFrom?: string;
  dateTo?: string;
  range?: {
    $gte?: Date;
    $lt?: Date;
  };
  limit: number;
};

type ProviderFinancialRollup = {
  provider: 'esewa' | 'khalti' | 'cod';
  expectedGross: number;
  settledGross: number;
  settledNet: number;
  settlementFees: number;
  pendingPayout: number;
  recordedPending: number;
  reconciliationGap: number;
  expectedOrders: number;
};

const VAT_RATE_PERCENT = (() => {
  const rawVatRate = Number(process.env.VAT_RATE_PERCENT ?? '13');
  if (!Number.isFinite(rawVatRate) || rawVatRate < 0 || rawVatRate > 100) {
    return 13;
  }

  return rawVatRate;
})();

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDateInput(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function resolveDateRange(input: {
  dateFrom?: string;
  dateTo?: string;
  limit: number;
}): { dateRange?: DateRange; error?: string } {
  const from = parseDateInput(input.dateFrom);
  const to = parseDateInput(input.dateTo);

  if (input.dateFrom && !from) {
    return { error: 'Invalid dateFrom query parameter' };
  }

  if (input.dateTo && !to) {
    return { error: 'Invalid dateTo query parameter' };
  }

  if (from && to && from.getTime() > to.getTime()) {
    return { error: 'dateFrom must be earlier than or equal to dateTo' };
  }

  const range: DateRange['range'] = {};
  if (from) {
    range.$gte = from;
  }
  if (to) {
    const inclusiveEnd = new Date(to.getTime());
    inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() + 1);
    range.$lt = inclusiveEnd;
  }

  return {
    dateRange: {
      dateFrom: from ? from.toISOString() : undefined,
      dateTo: to ? to.toISOString() : undefined,
      range: Object.keys(range).length > 0 ? range : undefined,
      limit: input.limit,
    },
  };
}

function toExpenseResponse(expense: {
  _id: mongoose.Types.ObjectId;
  title: string;
  category: string;
  amount: number;
  note?: string;
  incurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: expense._id.toString(),
    title: expense.title,
    category: expense.category,
    amount: roundCurrency(expense.amount),
    note: expense.note,
    incurredAt: expense.incurredAt,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

function toSettlementResponse(settlement: {
  _id: mongoose.Types.ObjectId;
  provider: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  status: string;
  settlementReference?: string;
  gatewayName?: string;
  settlementDate?: Date;
  reconciled: boolean;
  reconciledAt?: Date;
  reconciliationNote?: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: settlement._id.toString(),
    provider: settlement.provider,
    grossAmount: roundCurrency(settlement.grossAmount),
    feeAmount: roundCurrency(settlement.feeAmount),
    netAmount: roundCurrency(settlement.netAmount),
    status: settlement.status,
    settlementReference: settlement.settlementReference,
    gatewayName: settlement.gatewayName,
    settlementDate: settlement.settlementDate,
    reconciled: settlement.reconciled,
    reconciledAt: settlement.reconciledAt,
    reconciliationNote: settlement.reconciliationNote,
    createdAt: settlement.createdAt,
    updatedAt: settlement.updatedAt,
  };
}

function createDateFilteredMatch(params: {
  ownerId: mongoose.Types.ObjectId | string;
  dateField: 'createdAt' | 'incurredAt' | 'settlementDate';
  dateRange?: DateRange;
}): Record<string, unknown> {
  const match: Record<string, unknown> = {
    ownerId: params.ownerId,
  };

  const range = params.dateRange?.range;
  if (range && (range.$gte || range.$lt)) {
    match[params.dateField] = range;
  }

  return match;
}

async function getExpectedGrossByProvider(params: {
  ownerId: mongoose.Types.ObjectId;
  dateRange?: DateRange;
}): Promise<Record<'esewa' | 'khalti' | 'cod', { gross: number; orders: number }>> {
  const [esewa, khalti, cod] = await Promise.all([
    OrderModel.aggregate<{ gross: number; orders: number }>([
      {
        $match: {
          ...createDateFilteredMatch({ ownerId: params.ownerId, dateField: 'createdAt', dateRange: params.dateRange }),
          status: { $ne: 'cancelled' },
          paymentMethod: 'esewa',
          paymentStatus: 'paid',
        },
      },
      {
        $group: {
          _id: null,
          gross: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
    ]),
    OrderModel.aggregate<{ gross: number; orders: number }>([
      {
        $match: {
          ...createDateFilteredMatch({ ownerId: params.ownerId, dateField: 'createdAt', dateRange: params.dateRange }),
          status: { $ne: 'cancelled' },
          paymentMethod: 'khalti',
          paymentStatus: 'paid',
        },
      },
      {
        $group: {
          _id: null,
          gross: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
    ]),
    OrderModel.aggregate<{ gross: number; orders: number }>([
      {
        $match: {
          ...createDateFilteredMatch({ ownerId: params.ownerId, dateField: 'createdAt', dateRange: params.dateRange }),
          status: { $ne: 'cancelled' },
          paymentMethod: 'cod',
          codStatus: 'collected',
        },
      },
      {
        $group: {
          _id: null,
          gross: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    esewa: {
      gross: roundCurrency(esewa[0]?.gross ?? 0),
      orders: esewa[0]?.orders ?? 0,
    },
    khalti: {
      gross: roundCurrency(khalti[0]?.gross ?? 0),
      orders: khalti[0]?.orders ?? 0,
    },
    cod: {
      gross: roundCurrency(cod[0]?.gross ?? 0),
      orders: cod[0]?.orders ?? 0,
    },
  };
}

async function buildProviderRollups(params: {
  ownerId: mongoose.Types.ObjectId;
  dateRange?: DateRange;
}): Promise<{
  providers: ProviderFinancialRollup[];
  summary: {
    expectedGross: number;
    settledGross: number;
    settledNet: number;
    settlementFees: number;
    pendingPayout: number;
    recordedPending: number;
    reconciliationGap: number;
  };
}> {
  const expectedByProvider = await getExpectedGrossByProvider({
    ownerId: params.ownerId,
    dateRange: params.dateRange,
  });

  const settlementMatch: Record<string, unknown> = createDateFilteredMatch({
    ownerId: params.ownerId,
    dateField: 'settlementDate',
    dateRange: params.dateRange,
  });

  const settlements = await PayoutSettlementModel.find(settlementMatch);

  const settlementMap: Record<
    'esewa' | 'khalti' | 'cod',
    {
      settledGross: number;
      settledNet: number;
      settlementFees: number;
      recordedPending: number;
    }
  > = {
    esewa: { settledGross: 0, settledNet: 0, settlementFees: 0, recordedPending: 0 },
    khalti: { settledGross: 0, settledNet: 0, settlementFees: 0, recordedPending: 0 },
    cod: { settledGross: 0, settledNet: 0, settlementFees: 0, recordedPending: 0 },
  };

  settlements.forEach((settlement) => {
    if (settlement.provider !== 'esewa' && settlement.provider !== 'khalti' && settlement.provider !== 'cod') {
      return;
    }

    if (settlement.status === 'settled') {
      settlementMap[settlement.provider].settledGross = roundCurrency(
        settlementMap[settlement.provider].settledGross + settlement.grossAmount,
      );
      settlementMap[settlement.provider].settledNet = roundCurrency(
        settlementMap[settlement.provider].settledNet + settlement.netAmount,
      );
      settlementMap[settlement.provider].settlementFees = roundCurrency(
        settlementMap[settlement.provider].settlementFees + settlement.feeAmount,
      );
    } else if (settlement.status === 'pending') {
      settlementMap[settlement.provider].recordedPending = roundCurrency(
        settlementMap[settlement.provider].recordedPending + settlement.grossAmount,
      );
    }
  });

  const providers: ProviderFinancialRollup[] = PAYOUT_PROVIDER_VALUES.map((provider) => {
    const expectedGross = expectedByProvider[provider].gross;
    const expectedOrders = expectedByProvider[provider].orders;
    const settledGross = settlementMap[provider].settledGross;
    const settledNet = settlementMap[provider].settledNet;
    const settlementFees = settlementMap[provider].settlementFees;
    const recordedPending = settlementMap[provider].recordedPending;
    const pendingPayout = roundCurrency(Math.max(expectedGross - settledGross, 0));
    const reconciliationGap = roundCurrency(pendingPayout - recordedPending);

    return {
      provider,
      expectedGross,
      settledGross,
      settledNet,
      settlementFees,
      pendingPayout,
      recordedPending,
      reconciliationGap,
      expectedOrders,
    };
  });

  return {
    providers,
    summary: {
      expectedGross: roundCurrency(providers.reduce((sum, entry) => sum + entry.expectedGross, 0)),
      settledGross: roundCurrency(providers.reduce((sum, entry) => sum + entry.settledGross, 0)),
      settledNet: roundCurrency(providers.reduce((sum, entry) => sum + entry.settledNet, 0)),
      settlementFees: roundCurrency(providers.reduce((sum, entry) => sum + entry.settlementFees, 0)),
      pendingPayout: roundCurrency(providers.reduce((sum, entry) => sum + entry.pendingPayout, 0)),
      recordedPending: roundCurrency(providers.reduce((sum, entry) => sum + entry.recordedPending, 0)),
      reconciliationGap: roundCurrency(providers.reduce((sum, entry) => sum + entry.reconciliationGap, 0)),
    },
  };
}

financeRouter.get('/summary', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);

    const parsedQuery = financeDateRangeQuerySchema.safeParse({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: req.query.limit,
    });

    if (!parsedQuery.success) {
      return res.status(400).json({
        message: 'Invalid summary query',
        errors: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const resolvedRange = resolveDateRange(parsedQuery.data);
    if (resolvedRange.error || !resolvedRange.dateRange) {
      return res.status(400).json({
        message: resolvedRange.error || 'Unable to resolve summary date range',
      });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(req.userId);
    const orderMatch: Record<string, unknown> = {
      ...createDateFilteredMatch({
        ownerId: ownerObjectId,
        dateField: 'createdAt',
        dateRange: resolvedRange.dateRange,
      }),
      status: { $ne: 'cancelled' },
    };

    const [orderSummary] = await OrderModel.aggregate<{
      grossRevenue: number;
      netRevenue: number;
      totalDiscounts: number;
      orderCount: number;
    }>([
      {
        $match: orderMatch,
      },
      {
        $group: {
          _id: null,
          grossRevenue: { $sum: { $add: ['$subtotal', '$shippingFee', '$codFee'] } },
          netRevenue: { $sum: '$total' },
          totalDiscounts: { $sum: '$discountTotal' },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const [expenseSummary] = await FinanceExpenseModel.aggregate<{
      totalExpenses: number;
      expenseCount: number;
    }>([
      {
        $match: createDateFilteredMatch({
          ownerId: ownerObjectId,
          dateField: 'incurredAt',
          dateRange: resolvedRange.dateRange,
        }),
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' },
          expenseCount: { $sum: 1 },
        },
      },
    ]);

    const grossRevenue = roundCurrency(orderSummary?.grossRevenue ?? 0);
    const netRevenue = roundCurrency(orderSummary?.netRevenue ?? 0);
    const totalDiscounts = roundCurrency(orderSummary?.totalDiscounts ?? 0);
    const totalExpenses = roundCurrency(expenseSummary?.totalExpenses ?? 0);
    const netProfit = roundCurrency(netRevenue - totalExpenses);

    const vatTaxableAmount = netRevenue;
    const vatAmount = roundCurrency((vatTaxableAmount * VAT_RATE_PERCENT) / 100);
    const revenueExcludingVat = roundCurrency(vatTaxableAmount - vatAmount);

    return res.status(200).json({
      summary: {
        grossRevenue,
        netRevenue,
        totalDiscounts,
        totalExpenses,
        netProfit,
        orderCount: orderSummary?.orderCount ?? 0,
        expenseCount: expenseSummary?.expenseCount ?? 0,
        vatTaxableAmount,
        vatRatePercent: VAT_RATE_PERCENT,
        vatAmount,
        revenueExcludingVat,
        dateFrom: resolvedRange.dateRange.dateFrom,
        dateTo: resolvedRange.dateRange.dateTo,
      },
    });
  } catch (error) {
    console.error('Get finance summary error:', error);
    return res.status(500).json({ message: 'Unable to load finance summary' });
  }
});

financeRouter.get('/expenses', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const parsedQuery = financeDateRangeQuerySchema.safeParse({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: req.query.limit,
    });

    if (!parsedQuery.success) {
      return res.status(400).json({
        message: 'Invalid expenses query',
        errors: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const resolvedRange = resolveDateRange(parsedQuery.data);
    if (resolvedRange.error || !resolvedRange.dateRange) {
      return res.status(400).json({
        message: resolvedRange.error || 'Unable to resolve expense date range',
      });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(req.userId);
    const expenses = await FinanceExpenseModel.find(
      createDateFilteredMatch({
        ownerId: ownerObjectId,
        dateField: 'incurredAt',
        dateRange: resolvedRange.dateRange,
      }),
    )
      .sort({ incurredAt: -1, createdAt: -1 })
      .limit(resolvedRange.dateRange.limit);

    return res.status(200).json({
      expenses: expenses.map((expense) =>
        toExpenseResponse({
          _id: expense._id,
          title: expense.title,
          category: expense.category,
          amount: expense.amount,
          note: expense.note,
          incurredAt: expense.incurredAt,
          createdAt: expense.createdAt,
          updatedAt: expense.updatedAt,
        }),
      ),
    });
  } catch (error) {
    console.error('Get finance expenses error:', error);
    return res.status(500).json({ message: 'Unable to load expenses' });
  }
});

financeRouter.post('/expenses', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const parsed = createFinanceExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid expense payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const expense = await FinanceExpenseModel.create({
      ownerId: req.userId,
      title: parsed.data.title,
      category: parsed.data.category,
      amount: roundCurrency(parsed.data.amount),
      note: parsed.data.note,
      incurredAt: parsed.data.incurredAt,
    });

    return res.status(201).json({
      expense: toExpenseResponse({
        _id: expense._id,
        title: expense.title,
        category: expense.category,
        amount: expense.amount,
        note: expense.note,
        incurredAt: expense.incurredAt,
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
      }),
    });
  } catch (error) {
    console.error('Create finance expense error:', error);
    return res.status(500).json({ message: 'Unable to create expense' });
  }
});

financeRouter.patch('/expenses/:expenseId', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const expenseId = String(req.params.expenseId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      return res.status(400).json({ message: 'Invalid expense id' });
    }

    const parsed = updateFinanceExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid expense update payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const expense = await FinanceExpenseModel.findOne({ _id: expenseId, ownerId: req.userId });
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (parsed.data.title !== undefined) {
      expense.title = parsed.data.title;
    }
    if (parsed.data.category !== undefined) {
      expense.category = parsed.data.category;
    }
    if (parsed.data.amount !== undefined) {
      expense.amount = roundCurrency(parsed.data.amount);
    }
    if (parsed.data.note !== undefined) {
      expense.note = parsed.data.note;
    }
    if (parsed.data.incurredAt !== undefined) {
      expense.incurredAt = parsed.data.incurredAt;
    }

    await expense.save();

    return res.status(200).json({
      expense: toExpenseResponse({
        _id: expense._id,
        title: expense.title,
        category: expense.category,
        amount: expense.amount,
        note: expense.note,
        incurredAt: expense.incurredAt,
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
      }),
    });
  } catch (error) {
    console.error('Update finance expense error:', error);
    return res.status(500).json({ message: 'Unable to update expense' });
  }
});

financeRouter.delete('/expenses/:expenseId', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const expenseId = String(req.params.expenseId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      return res.status(400).json({ message: 'Invalid expense id' });
    }

    const deletedExpense = await FinanceExpenseModel.findOneAndDelete({
      _id: expenseId,
      ownerId: req.userId,
    });

    if (!deletedExpense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    return res.status(200).json({
      message: 'Expense deleted successfully',
      expenseId,
    });
  } catch (error) {
    console.error('Delete finance expense error:', error);
    return res.status(500).json({ message: 'Unable to delete expense' });
  }
});

financeRouter.get('/payouts', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await ensureMerchantDemoData(req.userId);

    const parsedQuery = financeDateRangeQuerySchema.safeParse({
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: req.query.limit,
    });

    if (!parsedQuery.success) {
      return res.status(400).json({
        message: 'Invalid payouts query',
        errors: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const resolvedRange = resolveDateRange(parsedQuery.data);
    if (resolvedRange.error || !resolvedRange.dateRange) {
      return res.status(400).json({
        message: resolvedRange.error || 'Unable to resolve payouts date range',
      });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(req.userId);
    const payoutsRollup = await buildProviderRollups({
      ownerId: ownerObjectId,
      dateRange: resolvedRange.dateRange,
    });

    const settlements = await PayoutSettlementModel.find(
      createDateFilteredMatch({
        ownerId: ownerObjectId,
        dateField: 'settlementDate',
        dateRange: resolvedRange.dateRange,
      }),
    )
      .sort({ settlementDate: -1, createdAt: -1 })
      .limit(resolvedRange.dateRange.limit);

    return res.status(200).json({
      payouts: {
        providers: payoutsRollup.providers,
        summary: payoutsRollup.summary,
        settlements: settlements.map((settlement) =>
          toSettlementResponse({
            _id: settlement._id,
            provider: settlement.provider,
            grossAmount: settlement.grossAmount,
            feeAmount: settlement.feeAmount,
            netAmount: settlement.netAmount,
            status: settlement.status,
            settlementReference: settlement.settlementReference,
            gatewayName: settlement.gatewayName,
            settlementDate: settlement.settlementDate,
            reconciled: settlement.reconciled,
            reconciledAt: settlement.reconciledAt,
            reconciliationNote: settlement.reconciliationNote,
            createdAt: settlement.createdAt,
            updatedAt: settlement.updatedAt,
          }),
        ),
        dateFrom: resolvedRange.dateRange.dateFrom,
        dateTo: resolvedRange.dateRange.dateTo,
      },
    });
  } catch (error) {
    console.error('Get payouts error:', error);
    return res.status(500).json({ message: 'Unable to load payouts' });
  }
});

financeRouter.post('/payouts/settlements', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const parsed = createPayoutSettlementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid settlement payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    if (parsed.data.feeAmount > parsed.data.grossAmount) {
      return res.status(400).json({ message: 'Fee amount cannot exceed gross amount' });
    }

    const netAmount = roundCurrency(parsed.data.grossAmount - parsed.data.feeAmount);
    const settlement = await PayoutSettlementModel.create({
      ownerId: req.userId,
      provider: parsed.data.provider,
      grossAmount: roundCurrency(parsed.data.grossAmount),
      feeAmount: roundCurrency(parsed.data.feeAmount),
      netAmount,
      status: parsed.data.status,
      settlementReference: parsed.data.settlementReference,
      gatewayName: parsed.data.gatewayName,
      settlementDate:
        parsed.data.settlementDate ?? (parsed.data.status === 'settled' ? new Date() : undefined),
      reconciled: false,
      reconciliationNote: parsed.data.reconciliationNote,
    });

    return res.status(201).json({
      settlement: toSettlementResponse({
        _id: settlement._id,
        provider: settlement.provider,
        grossAmount: settlement.grossAmount,
        feeAmount: settlement.feeAmount,
        netAmount: settlement.netAmount,
        status: settlement.status,
        settlementReference: settlement.settlementReference,
        gatewayName: settlement.gatewayName,
        settlementDate: settlement.settlementDate,
        reconciled: settlement.reconciled,
        reconciledAt: settlement.reconciledAt,
        reconciliationNote: settlement.reconciliationNote,
        createdAt: settlement.createdAt,
        updatedAt: settlement.updatedAt,
      }),
    });
  } catch (error) {
    console.error('Create settlement error:', error);
    return res.status(500).json({ message: 'Unable to create settlement' });
  }
});

financeRouter.patch('/payouts/settlements/:settlementId', requireAuth, requireMerchant, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const settlementId = String(req.params.settlementId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(settlementId)) {
      return res.status(400).json({ message: 'Invalid settlement id' });
    }

    const parsed = updatePayoutSettlementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Invalid settlement update payload',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const settlement = await PayoutSettlementModel.findOne({
      _id: settlementId,
      ownerId: req.userId,
    });
    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    if (parsed.data.grossAmount !== undefined) {
      settlement.grossAmount = roundCurrency(parsed.data.grossAmount);
    }
    if (parsed.data.feeAmount !== undefined) {
      settlement.feeAmount = roundCurrency(parsed.data.feeAmount);
    }

    if (settlement.feeAmount > settlement.grossAmount) {
      return res.status(400).json({ message: 'Fee amount cannot exceed gross amount' });
    }

    settlement.netAmount = roundCurrency(settlement.grossAmount - settlement.feeAmount);

    if (parsed.data.status !== undefined) {
      settlement.status = parsed.data.status;
      if (parsed.data.status === 'settled' && !settlement.settlementDate) {
        settlement.settlementDate = new Date();
      }
    }
    if (parsed.data.settlementReference !== undefined) {
      settlement.settlementReference = parsed.data.settlementReference;
    }
    if (parsed.data.gatewayName !== undefined) {
      settlement.gatewayName = parsed.data.gatewayName;
    }
    if (parsed.data.settlementDate !== undefined) {
      settlement.settlementDate = parsed.data.settlementDate ?? undefined;
    }
    if (parsed.data.reconciled !== undefined) {
      settlement.reconciled = parsed.data.reconciled;
      settlement.reconciledAt = parsed.data.reconciled ? new Date() : undefined;
    }
    if (parsed.data.reconciliationNote !== undefined) {
      settlement.reconciliationNote = parsed.data.reconciliationNote;
    }

    await settlement.save();

    return res.status(200).json({
      settlement: toSettlementResponse({
        _id: settlement._id,
        provider: settlement.provider,
        grossAmount: settlement.grossAmount,
        feeAmount: settlement.feeAmount,
        netAmount: settlement.netAmount,
        status: settlement.status,
        settlementReference: settlement.settlementReference,
        gatewayName: settlement.gatewayName,
        settlementDate: settlement.settlementDate,
        reconciled: settlement.reconciled,
        reconciledAt: settlement.reconciledAt,
        reconciliationNote: settlement.reconciliationNote,
        createdAt: settlement.createdAt,
        updatedAt: settlement.updatedAt,
      }),
    });
  } catch (error) {
    console.error('Update settlement error:', error);
    return res.status(500).json({ message: 'Unable to update settlement' });
  }
});

export default financeRouter;
