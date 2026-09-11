import { z } from '@hono/zod-openapi';
import { CurrencyCodeSchema, DecimalString, IsoDateSchema } from './common.js';
export const RateDtoSchema = z.object({
  base: CurrencyCodeSchema, quote: z.literal('USD'), value: DecimalString, date: IsoDateSchema, source: z.enum(['api', 'manual']),
}).openapi('Rate');
export type RateDto = z.infer<typeof RateDtoSchema>;
export const RatesQuerySchema = z.object({ date: IsoDateSchema.optional() });
export const ManualRateInputSchema = z.object({ base: CurrencyCodeSchema, date: IsoDateSchema, value: DecimalString }).openapi('ManualRateInput');
export type ManualRateInput = z.infer<typeof ManualRateInputSchema>;
