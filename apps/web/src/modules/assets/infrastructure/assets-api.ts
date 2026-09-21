import {
  AssetDtoSchema,
  ValuationDtoSchema,
  type AssetDto,
  type AssetInput,
  type UpdateAssetInput,
  type UpdateValuationInput,
  type ValuationDto,
  type ValuationInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const assets = listOf(AssetDtoSchema);
const valuations = listOf(ValuationDtoSchema);
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

export const assetsApi = (client: ApiClient) => ({
  list: async (): Promise<AssetDto[]> =>
    parse(await client.fetch('/assets', { method: 'GET' }), assets),
  create: async (input: AssetInput): Promise<AssetDto> =>
    parse(
      await client.fetch('/assets', { method: 'POST', body: JSON.stringify(input) }),
      AssetDtoSchema,
    ),
  update: async (id: string, input: UpdateAssetInput): Promise<AssetDto> =>
    parse(
      await client.fetch(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      AssetDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/assets/${id}`, { method: 'DELETE' }), noContent),

  valuations: async (assetId: string): Promise<ValuationDto[]> =>
    parse(await client.fetch(`/assets/${assetId}/valuations`, { method: 'GET' }), valuations),
  addValuation: async (assetId: string, input: ValuationInput): Promise<ValuationDto> =>
    parse(
      await client.fetch(`/assets/${assetId}/valuations`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
      ValuationDtoSchema,
    ),
  updateValuation: async (id: string, input: UpdateValuationInput): Promise<ValuationDto> =>
    parse(
      await client.fetch(`/valuations/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      ValuationDtoSchema,
    ),
  removeValuation: async (id: string): Promise<void> =>
    parse(await client.fetch(`/valuations/${id}`, { method: 'DELETE' }), noContent),
});
