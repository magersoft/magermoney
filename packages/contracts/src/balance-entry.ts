import { z } from '@hono/zod-openapi';
import { DecimalString } from './common.js';

export const BalanceEntryOriginSchema = z.enum(['manual', 'transfer', 'inflow']);

export const BalanceEntryDtoSchema = z
  .object({
    id: z.uuid(),
    accountId: z.uuid(),
    amount: DecimalString,
    recordedAt: z.iso.datetime(),
    origin: BalanceEntryOriginSchema,
    transferId: z.uuid().nullable(),
    note: z.string().nullable(),
  })
  .openapi('BalanceEntry');
export type BalanceEntryDto = z.infer<typeof BalanceEntryDtoSchema>;

export const RecordBalanceInputSchema = z
  .object({
    amount: DecimalString,
    recordedAt: z.iso.datetime().optional(),
    note: z.string().max(1000).nullable().optional(),
  })
  .openapi('RecordBalanceInput');
export type RecordBalanceInput = z.infer<typeof RecordBalanceInputSchema>;

export const UpdateBalanceInputSchema =
  RecordBalanceInputSchema.partial().openapi('UpdateBalanceInput');
export type UpdateBalanceInput = z.infer<typeof UpdateBalanceInputSchema>;

/** Cursor = `${isoTimestamp}|${id}` of the last row seen; rows strictly before it are returned. */
export const CursorQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T[^|]+\|[0-9a-f-]{36}$/)
    .optional(),
});
export type CursorQuery = z.infer<typeof CursorQuerySchema>;
