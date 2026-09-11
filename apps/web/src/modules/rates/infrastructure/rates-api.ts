import { RateDtoSchema, type RateDto } from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const rateList = listOf(RateDtoSchema);

/** `/rates`, for a day. The day defaults to the backend's today. */
export const ratesApi = (client: ApiClient) => ({
  list: async (date?: string): Promise<RateDto[]> =>
    parse(await client.fetch(date ? `/rates?date=${date}` : '/rates', { method: 'GET' }), rateList),
});
