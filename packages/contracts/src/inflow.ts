import { z } from '@hono/zod-openapi';
import {
  CurrencyCodeSchema,
  DecimalString,
  IsoDateSchema,
  PositiveDecimalString,
} from './common.js';

export const InflowDtoSchema = z
  .object({
    id: z.uuid(),
    incomeSourceId: z.uuid(),
    amount: DecimalString,
    currency: CurrencyCodeSchema,
    receivedOn: IsoDateSchema,
    realisedRateToUsd: DecimalString.nullable(),
    accountId: z.uuid().nullable(),
    /** What landed on the Account, in the Account's currency; null when the Inflow is not credited. */
    creditedAmount: DecimalString.nullable(),
    /** creditedAmount / amount when the Account holds another currency, else null. */
    realisedRate: DecimalString.nullable(),
    note: z.string().nullable(),
  })
  .openapi('Inflow');
export type InflowDto = z.infer<typeof InflowDtoSchema>;

const inflowFields = {
  incomeSourceId: z.uuid(),
  amount: PositiveDecimalString,
  /** Defaults to the source's currency. */
  currency: CurrencyCodeSchema.optional(),
  /** Defaults to today. */
  receivedOn: IsoDateSchema.optional(),
  realisedRateToUsd: PositiveDecimalString.nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
};

const creditNeedsAccount = (v: {
  accountId?: string | null | undefined;
  creditedAmount?: string | null | undefined;
}) => v.creditedAmount == null || v.accountId !== null;
const CREDIT_MESSAGE = {
  message: 'creditedAmount requires accountId',
  path: ['creditedAmount'],
};

export const CreateInflowInputSchema = z
  .object({
    ...inflowFields,
    accountId: z.uuid().optional(),
    creditedAmount: PositiveDecimalString.optional(),
  })
  .refine((v) => v.creditedAmount === undefined || v.accountId !== undefined, CREDIT_MESSAGE)
  .openapi('CreateInflowInput');
export type CreateInflowInput = z.infer<typeof CreateInflowInputSchema>;

/** `accountId: null` removes the credit; leaving it out keeps the Account as it is. */
export const UpdateInflowInputSchema = z
  .object({
    ...inflowFields,
    accountId: z.uuid().nullable(),
    creditedAmount: PositiveDecimalString.nullable(),
  })
  .partial()
  .refine(creditNeedsAccount, CREDIT_MESSAGE)
  .openapi('UpdateInflowInput');
export type UpdateInflowInput = z.infer<typeof UpdateInflowInputSchema>;

/** Cursor = `${receivedOn}|${id}` of the last row seen; rows strictly older come next. */
export const InflowsQuerySchema = z.object({
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  sourceId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}\|[0-9a-f-]{36}$/)
    .optional(),
});
export type InflowsQuery = z.infer<typeof InflowsQuerySchema>;
