import { CurrencyDtoSchema, type CurrencyDto } from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const currencyList = listOf(CurrencyDtoSchema);

/** `/currencies`, and nothing else. */
export const currenciesApi = (client: ApiClient) => ({
  list: async (): Promise<CurrencyDto[]> =>
    parse(await client.fetch('/currencies', { method: 'GET' }), currencyList),
});
