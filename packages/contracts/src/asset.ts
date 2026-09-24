import { z } from '@hono/zod-openapi';
import {
  CurrencyCodeSchema,
  DecimalString,
  IsoDateSchema,
  MarkColorSchema,
  MarkEmojiSchema,
  PositiveDecimalString,
} from './common.js';

export const AssetDtoSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    /** Both default to none, so a response from an API that predates them still parses. */
    icon: z.string().nullable().default(null),
    color: MarkColorSchema.nullable().default(null),
    currency: CurrencyCodeSchema,
    countsInTotal: z.boolean(),
    acquiredOn: IsoDateSchema.nullable(),
    purchasePrice: DecimalString.nullable(),
    archivedAt: z.iso.datetime().nullable(),
    /** The latest valuation; null until the asset has been valued once. */
    value: DecimalString.nullable(),
    valuedOn: IsoDateSchema.nullable(),
  })
  .openapi('Asset');
export type AssetDto = z.infer<typeof AssetDtoSchema>;

const assetFields = {
  name: z.string().trim().min(1).max(60),
  icon: MarkEmojiSchema.nullable().optional(),
  color: MarkColorSchema.nullable().optional(),
  currency: CurrencyCodeSchema,
  countsInTotal: z.boolean().default(false),
  acquiredOn: IsoDateSchema.nullable().optional(),
  purchasePrice: PositiveDecimalString.nullable().optional(),
};

export const AssetInputSchema = z.object(assetFields).openapi('AssetInput');
export type AssetInput = z.infer<typeof AssetInputSchema>;
export const UpdateAssetInputSchema = z
  .object({ ...assetFields, archivedAt: z.iso.datetime().nullable() })
  .partial()
  .openapi('UpdateAssetInput');
export type UpdateAssetInput = z.infer<typeof UpdateAssetInputSchema>;

export const ValuationDtoSchema = z
  .object({
    id: z.uuid(),
    assetId: z.uuid(),
    value: DecimalString,
    valuedOn: IsoDateSchema,
  })
  .openapi('Valuation');
export type ValuationDto = z.infer<typeof ValuationDtoSchema>;

export const ValuationInputSchema = z
  .object({
    value: PositiveDecimalString,
    /** Defaults to today in the use case. */
    valuedOn: IsoDateSchema.optional(),
  })
  .openapi('ValuationInput');
export type ValuationInput = z.infer<typeof ValuationInputSchema>;
export const UpdateValuationInputSchema =
  ValuationInputSchema.partial().openapi('UpdateValuationInput');
export type UpdateValuationInput = z.infer<typeof UpdateValuationInputSchema>;
