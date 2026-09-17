import {
  AccountDtoSchema,
  BalanceEntryDtoSchema,
  type AccountDto,
  type BalanceEntryDto,
  type CreateAccountInput,
  type RecordBalanceInput,
  type UpdateAccountInput,
  type UpdateBalanceInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const accountList = listOf(AccountDtoSchema);
const entryList = listOf(BalanceEntryDtoSchema);
/** The whole history in one page; the API pages by cursor if this is ever not enough. */
export const BALANCES_PAGE = 200;
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

export const accountsApi = (client: ApiClient) => ({
  list: async (): Promise<AccountDto[]> =>
    parse(await client.fetch('/accounts', { method: 'GET' }), accountList),
  create: async (input: CreateAccountInput): Promise<AccountDto> =>
    parse(
      await client.fetch('/accounts', { method: 'POST', body: JSON.stringify(input) }),
      AccountDtoSchema,
    ),
  update: async (id: string, input: UpdateAccountInput): Promise<AccountDto> =>
    parse(
      await client.fetch(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      AccountDtoSchema,
    ),
  archive: async (id: string, archived: boolean): Promise<AccountDto> =>
    parse(
      await client.fetch(`/accounts/${id}/${archived ? 'archive' : 'unarchive'}`, {
        method: 'POST',
      }),
      AccountDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/accounts/${id}`, { method: 'DELETE' }), noContent),
  balances: async (id: string, before?: string): Promise<BalanceEntryDto[]> => {
    const q = new URLSearchParams({ limit: String(BALANCES_PAGE), ...(before ? { before } : {}) });
    return parse(await client.fetch(`/accounts/${id}/balances?${q}`, { method: 'GET' }), entryList);
  },
  recordBalance: async (id: string, input: RecordBalanceInput): Promise<BalanceEntryDto> =>
    parse(
      await client.fetch(`/accounts/${id}/balances`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
      BalanceEntryDtoSchema,
    ),
  editBalance: async (entryId: string, input: UpdateBalanceInput): Promise<BalanceEntryDto> =>
    parse(
      await client.fetch(`/balances/${entryId}`, { method: 'PATCH', body: JSON.stringify(input) }),
      BalanceEntryDtoSchema,
    ),
  deleteBalance: async (entryId: string): Promise<void> =>
    parse(await client.fetch(`/balances/${entryId}`, { method: 'DELETE' }), noContent),
});
