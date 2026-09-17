import {
  ManualRateInputSchema,
  RateDtoSchema,
  type ManualRateInput,
  type RateDto,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const rateList = listOf(RateDtoSchema);

/** A 204 has no body to validate; this schema only exists to satisfy `parse`. */
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

/** `/rates`, for a day. The day defaults to the backend's today. */
export const ratesApi = (client: ApiClient) => ({
  list: async (date?: string): Promise<RateDto[]> =>
    parse(await client.fetch(date ? `/rates?date=${date}` : '/rates', { method: 'GET' }), rateList),

  /** Sets — or replaces — the manual override for one currency on one day. */
  setManual: async (input: ManualRateInput): Promise<RateDto> =>
    parse(
      await client.fetch('/rates/manual', {
        method: 'PUT',
        body: JSON.stringify(ManualRateInputSchema.parse(input)),
      }),
      RateDtoSchema,
    ),

  /** Drops the override, falling back to the API's own rate for that day. */
  removeManual: async (base: string, date: string): Promise<void> =>
    parse(
      await client.fetch(`/rates/manual?${new URLSearchParams({ base, date })}`, {
        method: 'DELETE',
      }),
      noContent,
    ),
});
