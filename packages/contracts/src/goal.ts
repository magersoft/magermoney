import { z } from '@hono/zod-openapi';
import {
  CurrencyCodeSchema,
  DecimalString,
  IsoDateSchema,
  PositiveDecimalString,
} from './common.js';

export const GoalDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    icon: z.string().nullable(),
    targetAmount: DecimalString,
    currency: CurrencyCodeSchema,
    targetDate: IsoDateSchema.nullable(),
    /** Stamped by the server when the goal is first funded; never sent by the client. */
    achievedAt: z.iso.datetime().nullable(),
    archivedAt: z.iso.datetime().nullable(),
    sortOrder: z.number().int(),
  })
  .openapi('Goal');
export type GoalDto = z.infer<typeof GoalDtoSchema>;

const goalFields = {
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(80).nullable().optional(),
  targetAmount: PositiveDecimalString,
  currency: CurrencyCodeSchema,
  targetDate: IsoDateSchema.nullable().optional(),
};

export const GoalInputSchema = z.object(goalFields).openapi('GoalInput');
export type GoalInput = z.infer<typeof GoalInputSchema>;

/**
 * `achievedAt` is here only so a goal can be re-opened by hand — the server
 * stamps it, and a falling rate never clears it.
 */
export const UpdateGoalInputSchema = z
  .object({
    ...goalFields,
    achievedAt: z.iso.datetime().nullable(),
    archivedAt: z.iso.datetime().nullable(),
  })
  .partial()
  .openapi('UpdateGoalInput');
export type UpdateGoalInput = z.infer<typeof UpdateGoalInputSchema>;
