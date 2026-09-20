import { z } from '@hono/zod-openapi';
import { ACCOUNT_KINDS, CARD_TYPES } from '@magermoney/domain';
import { CurrencyCodeSchema, DecimalString, IsoDateSchema } from './common.js';

export const AccountKindSchema = z.enum(ACCOUNT_KINDS);
export const CardTypeSchema = z.enum(CARD_TYPES);
export const IdParamSchema = z.object({ id: z.uuid() });

export const AccountDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    bank: z.string(),
    country: z.string(),
    currency: CurrencyCodeSchema,
    kind: AccountKindSchema,
    cardType: CardTypeSchema.nullable(),
    isSpending: z.boolean(),
    isPinned: z.boolean(),
    cardLast4: z.string().nullable(),
    cardNetwork: z.string().nullable(),
    cardTier: z.string().nullable(),
    cardExpires: IsoDateSchema.nullable(),
    note: z.string().nullable(),
    sortOrder: z.number().int(),
    archivedAt: z.iso.datetime().nullable(),
    balance: DecimalString.nullable(),
    balanceRecordedAt: z.iso.datetime().nullable(),
  })
  .openapi('Account');
export type AccountDto = z.infer<typeof AccountDtoSchema>;

const CARD_FIELDS = ['cardType', 'cardLast4', 'cardNetwork', 'cardTier', 'cardExpires'] as const;
const cardFieldsOnlyOnCards = (
  v: { kind?: string | undefined } & Partial<Record<(typeof CARD_FIELDS)[number], unknown>>,
) => v.kind === 'card' || CARD_FIELDS.every((f) => v[f] === undefined || v[f] === null);
const CARD_MESSAGE = { message: 'card fields require kind=card', path: ['kind'] };

const accountFields = {
  name: z.string().trim().min(1).max(80),
  bank: z.string().trim().min(1).max(80),
  country: z.string().regex(/^[A-Z]{2}$/),
  currency: CurrencyCodeSchema,
  kind: AccountKindSchema,
  cardType: CardTypeSchema.nullable().optional(),
  isSpending: z.boolean(),
  isPinned: z.boolean(),
  cardLast4: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
  cardNetwork: z.string().trim().max(40).nullable().optional(),
  cardTier: z.string().trim().max(40).nullable().optional(),
  cardExpires: IsoDateSchema.nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
};

export const OpeningBalanceSchema = z.object({
  amount: DecimalString,
  recordedAt: z.iso.datetime().optional(),
});

export const CreateAccountInputSchema = z
  .object({
    ...accountFields,
    isSpending: z.boolean().default(false),
    /*
     * Optional rather than defaulted, because nothing creating an account has
     * an opinion about it: the Home screen is chosen with the star on the
     * account's own screen, after it exists.
     */
    isPinned: z.boolean().optional(),
    openingBalance: OpeningBalanceSchema.optional(),
  })
  .refine(cardFieldsOnlyOnCards, CARD_MESSAGE)
  .openapi('CreateAccountInput');
export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

export const UpdateAccountInputSchema = z
  .object(accountFields)
  .partial()
  .refine(cardFieldsOnlyOnCards, CARD_MESSAGE)
  .openapi('UpdateAccountInput');
export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;

export const ReorderAccountsInputSchema = z
  .object({ ids: z.array(z.uuid()).min(1) })
  .openapi('ReorderAccountsInput');
export type ReorderAccountsInput = z.infer<typeof ReorderAccountsInputSchema>;
