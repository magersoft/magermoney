import { z } from '@hono/zod-openapi';
import {
  CurrencyCodeSchema,
  DecimalString,
  FractionString,
  IsoDateSchema,
  NonNegativeDecimalString,
} from './common.js';

export const PayDaysSchema = z
  .array(z.number().int().min(1).max(31))
  .max(31)
  .refine((days) => new Set(days).size === days.length, {
    message: 'pay days must be unique',
  })
  .openapi({ example: [10, 25] });

export const IncomeSourceDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    grossAmount: DecimalString,
    currency: CurrencyCodeSchema,
    taxRate: DecimalString,
    commissionRate: DecimalString,
    payDays: z.array(z.number().int()),
    isPrimary: z.boolean(),
    activeFrom: IsoDateSchema,
    activeTo: IsoDateSchema.nullable(),
    defaultAccountId: z.uuid().nullable(),
    /** gross × (1 − tax) × (1 − commission), rounded to the currency scale. Derived on read. */
    netMonthly: DecimalString,
  })
  .openapi('IncomeSource');
export type IncomeSourceDto = z.infer<typeof IncomeSourceDtoSchema>;

// No defaults in here: `.partial()` would inject them into an update.
const incomeSourceFields = {
  name: z.string().trim().min(1).max(80),
  grossAmount: NonNegativeDecimalString,
  currency: CurrencyCodeSchema,
  taxRate: FractionString,
  commissionRate: FractionString,
  payDays: PayDaysSchema,
  isPrimary: z.boolean(),
  /** Defaults to today in the use case. */
  activeFrom: IsoDateSchema.optional(),
  activeTo: IsoDateSchema.nullable().optional(),
  defaultAccountId: z.uuid().nullable().optional(),
};

/** Holds when either end is missing; the use case checks again against the stored row. */
export const endsAfterItStarts = (v: {
  activeFrom?: string | undefined;
  activeTo?: string | null | undefined;
}) => !v.activeFrom || !v.activeTo || v.activeTo >= v.activeFrom;
export const ACTIVE_PERIOD_MESSAGE = {
  message: 'activeTo must not be before activeFrom',
  path: ['activeTo'],
};

export const IncomeSourceInputSchema = z
  .object({
    ...incomeSourceFields,
    taxRate: FractionString.default('0'),
    commissionRate: FractionString.default('0'),
    payDays: PayDaysSchema.default([]),
    isPrimary: z.boolean().default(false),
  })
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('IncomeSourceInput');
export type IncomeSourceInput = z.infer<typeof IncomeSourceInputSchema>;

export const UpdateIncomeSourceInputSchema = z
  .object(incomeSourceFields)
  .partial()
  .refine(endsAfterItStarts, ACTIVE_PERIOD_MESSAGE)
  .openapi('UpdateIncomeSourceInput');
export type UpdateIncomeSourceInput = z.infer<typeof UpdateIncomeSourceInputSchema>;
