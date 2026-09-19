import { z } from '@hono/zod-openapi';
export const DecimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/)
  .openapi({ example: '24715.00', description: 'Exact decimal as a string' });
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .openapi({ example: '2026-09-11' });
export const CurrencyCodeSchema = z
  .string()
  .min(2)
  .max(10)
  .regex(/^[A-Z0-9]+$/)
  .openapi({ example: 'EUR' });
export const ErrorDtoSchema = z.object({ code: z.string(), message: z.string() }).openapi('Error');
export type ErrorDto = z.infer<typeof ErrorDtoSchema>;

/** Amounts that may be zero but never negative: a gross amount, an expense, a budget limit. */
export const NonNegativeDecimalString = DecimalString.refine((v) => !v.startsWith('-'), {
  message: 'must not be negative',
});
/** Amounts that must be greater than zero: an inflow, a realised rate. */
export const PositiveDecimalString = DecimalString.refine((v) => /^(?!-)(?=.*[1-9])/.test(v), {
  message: 'must be greater than zero',
});
/** A share such as a tax or commission rate: 0 ≤ value < 1, as a decimal string. */
export const FractionString = DecimalString.refine((v) => /^0(\.\d+)?$/.test(v), {
  message: 'must be at least 0 and less than 1',
}).openapi({ example: '0.15' });
