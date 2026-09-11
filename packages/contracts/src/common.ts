import { z } from '@hono/zod-openapi';
export const DecimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/)
  .openapi({ example: '24715.00', description: 'Exact decimal as a string' });
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .openapi({ example: '2026-09-11' });
export const CurrencyCodeSchema = z
  .string()
  .min(2)
  .max(10)
  .regex(/^[A-Z0-9]+$/)
  .openapi({ example: 'EUR' });
export const ErrorDtoSchema = z.object({ code: z.string(), message: z.string() }).openapi('Error');
export type ErrorDto = z.infer<typeof ErrorDtoSchema>;
