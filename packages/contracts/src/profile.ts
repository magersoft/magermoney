import { z } from '@hono/zod-openapi';
import { CurrencyCodeSchema } from './common.js';
export const ProfileDtoSchema = z.object({
  id: z.uuid(), displayName: z.string().nullable(), locale: z.enum(['ru', 'en']),
  defaultCurrency: CurrencyCodeSchema, reportingCurrencies: z.array(CurrencyCodeSchema).min(1),
  onboardingCompletedAt: z.iso.datetime().nullable(),
}).openapi('Profile');
export type ProfileDto = z.infer<typeof ProfileDtoSchema>;
export const UpdateProfileInputSchema = z.object({
  displayName: z.string().max(80).optional(), locale: z.enum(['ru', 'en']).optional(),
  defaultCurrency: CurrencyCodeSchema.optional(), reportingCurrencies: z.array(CurrencyCodeSchema).min(1).max(12).optional(),
}).refine((v) => !v.defaultCurrency || !v.reportingCurrencies || v.reportingCurrencies.includes(v.defaultCurrency), {
  message: 'defaultCurrency must be one of reportingCurrencies', path: ['defaultCurrency'],
}).openapi('UpdateProfileInput');
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
