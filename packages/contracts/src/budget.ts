import { z } from '@hono/zod-openapi';
import {
  CurrencyCodeSchema,
  DecimalString,
  IsoDateSchema,
  NonNegativeDecimalString,
} from './common.js';
import { ACTIVE_PERIOD_MESSAGE, endsAfterItStarts } from './income-source.js';

export const BudgetDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    icon: z.string().nullable(),
    monthlyLimit: DecimalString,
    currency: CurrencyCodeSchema,
    activeFrom: IsoDateSchema,
    activeTo: IsoDateSchema.nullable(),
  })
  .openapi('Budget');
export type BudgetDto = z.infer<typeof BudgetDtoSchema>;

const budgetFields = {
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(80).nullable().optional(),
  monthlyLimit: NonNegativeDecimalString,
  currency: CurrencyCodeSchema,
  /** Defaults to today in the use case. */
  activeFrom: IsoDateSchema.optional(),
  activeTo: IsoDateSchema.nullable().optional(),
};

export const BudgetInputSchema = z
  .object(budgetFields)
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('BudgetInput');
export type BudgetInput = z.infer<typeof BudgetInputSchema>;

export const UpdateBudgetInputSchema = z
  .object(budgetFields)
  .partial()
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('UpdateBudgetInput');
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetInputSchema>;
