import { z } from '@hono/zod-openapi';
import { CurrencyCodeSchema, DecimalString, IsoDateSchema } from './common.js';
export const RateDtoSchema = z
  .object({
    base: CurrencyCodeSchema,
    quote: z.literal('USD'),
    value: DecimalString,
    date: IsoDateSchema,
    source: z.enum(['api', 'manual']),
  })
  .openapi('Rate');
export type RateDto = z.infer<typeof RateDtoSchema>;
export const RatesQuerySchema = z.object({ date: IsoDateSchema.optional() });
export const ManualRateInputSchema = z
  .object({ base: CurrencyCodeSchema, date: IsoDateSchema, value: DecimalString })
  .openapi('ManualRateInput');
export type ManualRateInput = z.infer<typeof ManualRateInputSchema>;
/**
 * What a user-triggered refresh did. `refreshed: false` is a success: the rates
 * on record were still fresh, so no provider was asked.
 */
export const RefreshRatesResultSchema = z
  .object({
    stored: z.number().int().min(0),
    refreshed: z.boolean(),
    refreshedAt: z.string().datetime(),
  })
  .openapi('RefreshRatesResult');
export type RefreshRatesResult = z.infer<typeof RefreshRatesResultSchema>;
export const DeleteManualRateQuerySchema = z.object({
  base: CurrencyCodeSchema,
  date: IsoDateSchema,
});
export type DeleteManualRateQuery = z.infer<typeof DeleteManualRateQuerySchema>;
