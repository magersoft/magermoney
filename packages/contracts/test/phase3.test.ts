import { describe, expect, it } from 'vitest';
import {
  BalanceEntryDtoSchema,
  BudgetInputSchema,
  CreateInflowInputSchema,
  ExpenseCategoryInputSchema,
  ExpenseInputSchema,
  FractionString,
  IncomeSourceInputSchema,
  InflowsQuerySchema,
  NonNegativeDecimalString,
  PositiveDecimalString,
  UpdateBudgetInputSchema,
  UpdateExpenseCategoryInputSchema,
  UpdateExpenseInputSchema,
  UpdateIncomeSourceInputSchema,
  UpdateInflowInputSchema,
} from '../src/index.js';

const ID = '3f2b8c1e-5a4d-4e6f-8a9b-0c1d2e3f4a5b';
const OTHER_ID = '7a1c9e2d-3b4f-4a5c-9d8e-1f2a3b4c5d6e';

describe('balance entry contracts (phase 3 extension)', () => {
  const base = {
    id: ID,
    accountId: OTHER_ID,
    amount: '100',
    recordedAt: '2026-09-04T10:00:00.000Z',
    origin: 'manual' as const,
    transferId: null,
    note: null,
  };
  it('defaults inflowId to null when absent', () => {
    expect(BalanceEntryDtoSchema.parse(base)).toEqual({ ...base, inflowId: null });
  });
  it('accepts an explicit inflowId', () => {
    expect(BalanceEntryDtoSchema.parse({ ...base, inflowId: ID }).inflowId).toBe(ID);
  });
});

describe('decimal refinements', () => {
  it('NonNegativeDecimalString allows zero and refuses a minus', () => {
    expect(NonNegativeDecimalString.safeParse('0').success).toBe(true);
    expect(NonNegativeDecimalString.safeParse('12.50').success).toBe(true);
    expect(NonNegativeDecimalString.safeParse('-0.01').success).toBe(false);
  });
  it('PositiveDecimalString refuses zero in any spelling', () => {
    expect(PositiveDecimalString.safeParse('0.01').success).toBe(true);
    expect(PositiveDecimalString.safeParse('0').success).toBe(false);
    expect(PositiveDecimalString.safeParse('0.00').success).toBe(false);
    expect(PositiveDecimalString.safeParse('-5').success).toBe(false);
  });
  it('FractionString is at least 0 and less than 1', () => {
    expect(FractionString.safeParse('0').success).toBe(true);
    expect(FractionString.safeParse('0.15').success).toBe(true);
    expect(FractionString.safeParse('1').success).toBe(false);
    expect(FractionString.safeParse('1.5').success).toBe(false);
    expect(FractionString.safeParse('-0.1').success).toBe(false);
  });
});

describe('income source contracts', () => {
  const base = {
    name: 'Acme Salary',
    grossAmount: '4200',
    currency: 'USD',
    activeFrom: '2025-01-01',
  };
  it('fills the defaults of a minimal source', () => {
    expect(IncomeSourceInputSchema.parse(base)).toEqual({
      ...base,
      taxRate: '0',
      commissionRate: '0',
      payDays: [],
      isPrimary: false,
    });
  });
  it('leaves activeFrom to the use case when it is missing', () => {
    const noStart = { name: base.name, grossAmount: base.grossAmount, currency: base.currency };
    expect(IncomeSourceInputSchema.parse(noStart).activeFrom).toBeUndefined();
  });
  it('accepts a full source', () => {
    const r = IncomeSourceInputSchema.safeParse({
      ...base,
      taxRate: '0.15',
      commissionRate: '0.10',
      payDays: [10, 25],
      isPrimary: true,
      activeTo: '2026-12-31',
      defaultAccountId: ID,
    });
    expect(r.success).toBe(true);
  });
  it('refuses repeated or impossible pay days, a rate of 1, a negative gross and an end before the start', () => {
    expect(IncomeSourceInputSchema.safeParse({ ...base, payDays: [10, 10] }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, payDays: [0] }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, payDays: [32] }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, payDays: [1.5] }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, taxRate: '1' }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, grossAmount: '-1' }).success).toBe(false);
    expect(IncomeSourceInputSchema.safeParse({ ...base, activeTo: '2024-12-31' }).success).toBe(
      false,
    );
  });
  it('a partial update injects no defaults and may end the source', () => {
    expect(UpdateIncomeSourceInputSchema.parse({ activeTo: '2026-09-30' })).toEqual({
      activeTo: '2026-09-30',
    });
    expect(UpdateIncomeSourceInputSchema.parse({ activeTo: null })).toEqual({
      activeTo: null,
    });
    expect(
      UpdateIncomeSourceInputSchema.safeParse({
        activeFrom: '2026-10-01',
        activeTo: '2026-09-30',
      }).success,
    ).toBe(false);
  });
});

describe('inflow contracts', () => {
  const base = { incomeSourceId: ID, amount: '4200' };
  it('accepts a bare inflow and a credited one', () => {
    expect(CreateInflowInputSchema.parse(base)).toEqual(base);
    expect(
      CreateInflowInputSchema.safeParse({
        ...base,
        currency: 'USD',
        receivedOn: '2026-09-04',
        realisedRateToUsd: '0.0125',
        accountId: OTHER_ID,
        creditedAmount: '3864.20',
        note: 'September',
      }).success,
    ).toBe(true);
  });
  it('refuses a zero amount, a credited amount without an account and a timestamp for a date', () => {
    expect(CreateInflowInputSchema.safeParse({ ...base, amount: '0' }).success).toBe(false);
    expect(CreateInflowInputSchema.safeParse({ ...base, creditedAmount: '10' }).success).toBe(
      false,
    );
    expect(
      CreateInflowInputSchema.safeParse({
        ...base,
        receivedOn: '2026-09-04T10:00:00Z',
      }).success,
    ).toBe(false);
  });
  it('an update may drop the credit with accountId null, but not while naming a credited amount', () => {
    expect(UpdateInflowInputSchema.parse({ accountId: null })).toEqual({
      accountId: null,
    });
    expect(UpdateInflowInputSchema.parse({ creditedAmount: '12.5' })).toEqual({
      creditedAmount: '12.5',
    });
    expect(
      UpdateInflowInputSchema.safeParse({
        accountId: null,
        creditedAmount: '12.5',
      }).success,
    ).toBe(false);
  });
  it('coerces the list limit and takes a date cursor', () => {
    expect(InflowsQuerySchema.parse({}).limit).toBe(50);
    expect(
      InflowsQuerySchema.parse({
        limit: '20',
        from: '2026-09-01',
        to: '2026-09-30',
        sourceId: ID,
      }),
    ).toEqual({
      limit: 20,
      from: '2026-09-01',
      to: '2026-09-30',
      sourceId: ID,
    });
    expect(InflowsQuerySchema.safeParse({ before: `2026-09-04|${ID}` }).success).toBe(true);
    expect(InflowsQuerySchema.safeParse({ before: `2026-09-04T00:00:00Z|${ID}` }).success).toBe(
      false,
    );
    expect(InflowsQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('expense contracts', () => {
  const base = {
    name: 'Rent',
    amount: '900',
    currency: 'EUR',
    period: 'monthly',
    activeFrom: '2025-01-01',
  };
  it('needs exactly one of categoryId and categoryName', () => {
    expect(ExpenseInputSchema.safeParse({ ...base, categoryId: ID }).success).toBe(true);
    expect(ExpenseInputSchema.safeParse({ ...base, categoryName: 'Housing' }).success).toBe(true);
    expect(ExpenseInputSchema.safeParse(base).success).toBe(false);
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        categoryName: 'Housing',
      }).success,
    ).toBe(false);
  });
  it('defaults isEssential to false', () => {
    expect(ExpenseInputSchema.parse({ ...base, categoryId: ID }).isEssential).toBe(false);
  });
  it('allows a billing month only on a yearly expense', () => {
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        billingDay: 5,
        billingMonth: 3,
      }).success,
    ).toBe(false);
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        period: 'yearly',
        billingDay: 15,
        billingMonth: 1,
      }).success,
    ).toBe(true);
    expect(ExpenseInputSchema.safeParse({ ...base, categoryId: ID, billingDay: 32 }).success).toBe(
      false,
    );
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        period: 'yearly',
        billingMonth: 13,
      }).success,
    ).toBe(false);
  });
  it('refuses a negative amount, an unknown period and an end before the start', () => {
    expect(ExpenseInputSchema.safeParse({ ...base, categoryId: ID, amount: '-1' }).success).toBe(
      false,
    );
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        period: 'weekly',
      }).success,
    ).toBe(false);
    expect(
      ExpenseInputSchema.safeParse({
        ...base,
        categoryId: ID,
        activeTo: '2024-01-01',
      }).success,
    ).toBe(false);
  });
  it('a partial update injects no defaults and leaves the merged checks to the use case', () => {
    expect(UpdateExpenseInputSchema.parse({ isEssential: true })).toEqual({
      isEssential: true,
    });
    expect(UpdateExpenseInputSchema.safeParse({ billingMonth: 3 }).success).toBe(true);
    expect(UpdateExpenseInputSchema.safeParse({ period: 'monthly', billingMonth: 3 }).success).toBe(
      false,
    );
    expect(
      UpdateExpenseInputSchema.safeParse({
        categoryId: ID,
        categoryName: 'Housing',
      }).success,
    ).toBe(false);
  });
  it('validates categories', () => {
    expect(ExpenseCategoryInputSchema.parse({ name: '  Housing ' })).toEqual({
      name: 'Housing',
    });
    expect(ExpenseCategoryInputSchema.safeParse({ name: '' }).success).toBe(false);
    expect(UpdateExpenseCategoryInputSchema.parse({ sortOrder: 2 })).toEqual({
      sortOrder: 2,
    });
  });
});

describe('budget contracts', () => {
  const base = {
    name: 'Groceries',
    monthlyLimit: '600',
    currency: 'EUR',
    activeFrom: '2026-09-01',
  };
  it('accepts a budget and refuses a negative limit', () => {
    expect(BudgetInputSchema.safeParse({ ...base, icon: 'lucide:shopping-basket' }).success).toBe(
      true,
    );
    expect(BudgetInputSchema.safeParse({ ...base, monthlyLimit: '-1' }).success).toBe(false);
    expect(BudgetInputSchema.safeParse({ ...base, activeTo: '2026-08-31' }).success).toBe(false);
  });
  it('a partial update injects no defaults', () => {
    expect(UpdateBudgetInputSchema.parse({ monthlyLimit: '750' })).toEqual({
      monthlyLimit: '750',
    });
  });
});
