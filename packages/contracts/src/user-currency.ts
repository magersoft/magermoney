import { z } from '@hono/zod-openapi';
import { CurrencyCodeSchema } from './common.js';

/**
 * Where a currency is still in use, when disconnecting it is refused. The
 * screen names the places rather than saying "in use somewhere", which leaves
 * the person hunting.
 */
export const CurrencyUsageSchema = z
  .object({
    accounts: z.number().int().min(0),
    budgets: z.number().int().min(0),
    expenses: z.number().int().min(0),
    incomeSources: z.number().int().min(0),
    inflows: z.number().int().min(0),
    /** The currency is the profile's default, or sits in the display switch. */
    profile: z.boolean(),
  })
  .openapi('CurrencyUsage');
export type CurrencyUsage = z.infer<typeof CurrencyUsageSchema>;

export const ConnectCurrencyInputSchema = z
  .object({ code: CurrencyCodeSchema })
  .openapi('ConnectCurrencyInput');
export type ConnectCurrencyInput = z.infer<typeof ConnectCurrencyInputSchema>;

export const CurrencyCodeParamSchema = z.object({
  code: CurrencyCodeSchema.openapi({ param: { name: 'code', in: 'path' } }),
});
