import { z } from '@hono/zod-openapi';
import { MARK_COLORS, isMarkEmoji } from '@magermoney/domain';
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

/** One emoji marking a goal or an asset, drawn on its disc in place of the initial. */
export const MarkEmojiSchema = z
  .string()
  .refine(isMarkEmoji, { message: 'must be a single emoji' })
  .openapi({ example: '🚗' });
/** A card-palette colour for a goal's or an asset's disc, by name. */
export const MarkColorSchema = z.enum(MARK_COLORS);
