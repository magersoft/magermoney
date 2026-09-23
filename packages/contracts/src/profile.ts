import { z } from '@hono/zod-openapi';
import { AVATAR_COLORS, isAvatarEmoji } from '@magermoney/domain';
import { CurrencyCodeSchema } from './common.js';

/** One emoji, drawn on the disc in place of the initial. */
export const AvatarEmojiSchema = z
  .string()
  .refine(isAvatarEmoji, { message: 'must be a single emoji' })
  .openapi({ example: '🦊' });
/** A card-palette colour for the disc, by name. */
export const AvatarColorSchema = z.enum(AVATAR_COLORS);

/**
 * How many currencies the display switch can offer.
 *
 * Five fits because past two the switch stops showing codes and identifies the
 * currencies by their marks, keeping the code only on the one that is on — so
 * a segment costs the width of a flag. Past five, "tap the one you want" turns
 * into reading a list, and the header is not where anyone wants to read one.
 */
export const MAX_REPORTING_CURRENCIES = 5;
export const ProfileDtoSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string().nullable(),
    locale: z.enum(['ru', 'en']),
    defaultCurrency: CurrencyCodeSchema,
    reportingCurrencies: z.array(CurrencyCodeSchema).min(1).max(MAX_REPORTING_CURRENCIES),
    onboardingCompletedAt: z.iso.datetime().nullable(),
    /** Null: the disc shows the initial of the name. */
    avatarEmoji: AvatarEmojiSchema.nullable(),
    /** Null: the disc keeps the surface colour. */
    avatarColor: AvatarColorSchema.nullable(),
  })
  .openapi('Profile');
export type ProfileDto = z.infer<typeof ProfileDtoSchema>;
export const UpdateProfileInputSchema = z
  .object({
    displayName: z.string().max(80).optional(),
    locale: z.enum(['ru', 'en']).optional(),
    defaultCurrency: CurrencyCodeSchema.optional(),
    reportingCurrencies: z
      .array(CurrencyCodeSchema)
      .min(1)
      .max(MAX_REPORTING_CURRENCIES)
      .optional(),
    /** Absent leaves the stored value alone; null clears it. */
    avatarEmoji: AvatarEmojiSchema.nullable().optional(),
    avatarColor: AvatarColorSchema.nullable().optional(),
  })
  .refine(
    (v) =>
      !v.defaultCurrency ||
      !v.reportingCurrencies ||
      v.reportingCurrencies.includes(v.defaultCurrency),
    {
      message: 'defaultCurrency must be one of reportingCurrencies',
      path: ['defaultCurrency'],
    },
  )
  .openapi('UpdateProfileInput');
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
