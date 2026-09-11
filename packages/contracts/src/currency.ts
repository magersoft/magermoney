import { z } from '@hono/zod-openapi';
import { CurrencyCodeSchema } from './common.js';
export const CurrencyDtoSchema = z.object({
  code: CurrencyCodeSchema, kind: z.enum(['fiat', 'crypto']), scale: z.number().int().min(0).max(18),
  symbol: z.string().nullable(), nameRu: z.string().nullable(), nameEn: z.string().nullable(), icon: z.string().nullable(),
}).openapi('Currency');
export type CurrencyDto = z.infer<typeof CurrencyDtoSchema>;
