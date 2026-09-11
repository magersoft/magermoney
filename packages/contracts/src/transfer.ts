import { z } from '@hono/zod-openapi';
import { DecimalString } from './common.js';
import { CursorQuerySchema } from './balance-entry.js';

export const TransferDtoSchema = z
  .object({
    id: z.uuid(),
    fromAccountId: z.uuid(),
    toAccountId: z.uuid(),
    amountSent: DecimalString,
    amountReceived: DecimalString,
    occurredAt: z.iso.datetime(),
    note: z.string().nullable(),
    /** received / sent when currencies differ, else null. */
    realisedRate: DecimalString.nullable(),
    /** sent − received when currencies match, else null. */
    fee: DecimalString.nullable(),
  })
  .openapi('Transfer');
export type TransferDto = z.infer<typeof TransferDtoSchema>;

export const CreateTransferInputSchema = z
  .object({
    fromAccountId: z.uuid(),
    toAccountId: z.uuid(),
    amountSent: DecimalString,
    amountReceived: DecimalString.optional(),
    occurredAt: z.iso.datetime().optional(),
    note: z.string().max(1000).nullable().optional(),
  })
  .openapi('CreateTransferInput');
export type CreateTransferInput = z.infer<typeof CreateTransferInputSchema>;

export const UpdateTransferInputSchema =
  CreateTransferInputSchema.partial().openapi('UpdateTransferInput');
export type UpdateTransferInput = z.infer<typeof UpdateTransferInputSchema>;

export const TransfersQuerySchema = CursorQuerySchema.extend({ accountId: z.uuid().optional() });
export type TransfersQuery = z.infer<typeof TransfersQuerySchema>;
