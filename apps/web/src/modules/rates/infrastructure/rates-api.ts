import { CurrencyDtoSchema, RateDtoSchema, type CurrencyDto, type RateDto } from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const currencyList = listOf(CurrencyDtoSchema);
const rateList = listOf(RateDtoSchema);

/** The two read-only endpoints the money on screen depends on. */
export const ratesApi = (client: ApiClient) => ({
  list: async (date?: string): Promise<RateDto[]> =>
    parse(await client.fetch(date ? `/rates?date=${date}` : '/rates', { method: 'GET' }), rateList),
  currencies: async (): Promise<CurrencyDto[]> =>
    parse(await client.fetch('/currencies', { method: 'GET' }), currencyList),
});
