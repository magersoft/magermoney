import { CurrencyDtoSchema, type CurrencyDto } from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const currencyList = listOf(CurrencyDtoSchema);

/** A 204 has no body to validate; this schema only exists to satisfy `parse`. */
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

/**
 * Two lists, and the difference matters. `/currencies` is the catalogue — every
 * currency there is, which only the picker wants. `/me/currencies` is what this
 * person has connected, which is what every form and every screen shows.
 */
export const currenciesApi = (client: ApiClient) => ({
  catalogue: async (): Promise<CurrencyDto[]> =>
    parse(await client.fetch('/currencies', { method: 'GET' }), currencyList),
  list: async (): Promise<CurrencyDto[]> =>
    parse(await client.fetch('/me/currencies', { method: 'GET' }), currencyList),
  connect: async (code: string): Promise<CurrencyDto[]> =>
    parse(
      await client.fetch('/me/currencies', { method: 'POST', body: JSON.stringify({ code }) }),
      currencyList,
    ),
  /** Refused with 409 while accounts, budgets or the profile still point at it. */
  disconnect: async (code: string): Promise<void> =>
    parse(await client.fetch(`/me/currencies/${code}`, { method: 'DELETE' }), noContent),
});
