import { z } from '@hono/zod-openapi';
import { EXPENSE_PERIODS } from '@magermoney/domain';
import {
  CurrencyCodeSchema,
  DecimalString,
  IsoDateSchema,
  NonNegativeDecimalString,
} from './common.js';
import { ACTIVE_PERIOD_MESSAGE, endsAfterItStarts } from './income-source.js';

export const ExpensePeriodSchema = z.enum(EXPENSE_PERIODS);

export const ExpenseCategoryDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    icon: z.string().nullable(),
    sortOrder: z.number().int(),
  })
  .openapi('ExpenseCategory');
export type ExpenseCategoryDto = z.infer<typeof ExpenseCategoryDtoSchema>;

const categoryFields = {
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(80).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
};
export const ExpenseCategoryInputSchema = z.object(categoryFields).openapi('ExpenseCategoryInput');
export type ExpenseCategoryInput = z.infer<typeof ExpenseCategoryInputSchema>;
export const UpdateExpenseCategoryInputSchema = z
  .object(categoryFields)
  .partial()
  .openapi('UpdateExpenseCategoryInput');
export type UpdateExpenseCategoryInput = z.infer<typeof UpdateExpenseCategoryInputSchema>;

export const ExpenseDtoSchema = z
  .object({
    id: z.uuid(),
    categoryId: z.uuid(),
    name: z.string(),
    amount: DecimalString,
    currency: CurrencyCodeSchema,
    period: ExpensePeriodSchema,
    billingDay: z.number().int().nullable(),
    billingMonth: z.number().int().nullable(),
    isEssential: z.boolean(),
    activeFrom: IsoDateSchema,
    activeTo: IsoDateSchema.nullable(),
  })
  .openapi('Expense');
export type ExpenseDto = z.infer<typeof ExpenseDtoSchema>;

const expenseFields = {
  /** An existing category… */
  categoryId: z.uuid().optional(),
  /** …or a name: an unknown one is created together with the expense. */
  categoryName: z.string().trim().min(1).max(60).optional(),
  name: z.string().trim().min(1).max(80),
  amount: NonNegativeDecimalString,
  currency: CurrencyCodeSchema,
  period: ExpensePeriodSchema,
  billingDay: z.number().int().min(1).max(31).nullable().optional(),
  billingMonth: z.number().int().min(1).max(12).nullable().optional(),
  isEssential: z.boolean(),
  /** Defaults to today in the use case. */
  activeFrom: IsoDateSchema.optional(),
  activeTo: IsoDateSchema.nullable().optional(),
};

/** Holds when the period is not in the payload; the use case checks again against the stored row. */
const billingMonthOnlyYearly = (v: {
  period?: string | undefined;
  billingMonth?: number | null | undefined;
}) => v.billingMonth == null || v.period === undefined || v.period === 'yearly';
const BILLING_MONTH_MESSAGE = {
  message: 'billingMonth requires period=yearly',
  path: ['billingMonth'],
};
const notBothCategories = (v: {
  categoryId?: string | undefined;
  categoryName?: string | undefined;
}) => v.categoryId === undefined || v.categoryName === undefined;
const CATEGORY_MESSAGE = {
  message: 'give exactly one of categoryId and categoryName',
  path: ['categoryId'],
};

export const ExpenseInputSchema = z
  .object({ ...expenseFields, isEssential: z.boolean().default(false) })
  .refine(
    (v) => notBothCategories(v) && (v.categoryId !== undefined || v.categoryName !== undefined),
    CATEGORY_MESSAGE,
  )
  .refine(billingMonthOnlyYearly, BILLING_MONTH_MESSAGE)
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('ExpenseInput');
export type ExpenseInput = z.infer<typeof ExpenseInputSchema>;

export const UpdateExpenseInputSchema = z
  .object(expenseFields)
  .partial()
  .refine(notBothCategories, CATEGORY_MESSAGE)
  .refine(billingMonthOnlyYearly, BILLING_MONTH_MESSAGE)
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('UpdateExpenseInput');
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseInputSchema>;
