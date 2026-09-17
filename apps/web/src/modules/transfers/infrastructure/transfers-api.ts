import {
  TransferDtoSchema,
  type CreateTransferInput,
  type TransferDto,
  type UpdateTransferInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const list = listOf(TransferDtoSchema);
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

export const transfersApi = (client: ApiClient) => ({
  list: async (accountId?: string): Promise<TransferDto[]> => {
    const q = new URLSearchParams({ limit: '200', ...(accountId ? { accountId } : {}) });
    return parse(await client.fetch(`/transfers?${q}`, { method: 'GET' }), list);
  },
  create: async (input: CreateTransferInput): Promise<TransferDto> =>
    parse(
      await client.fetch('/transfers', { method: 'POST', body: JSON.stringify(input) }),
      TransferDtoSchema,
    ),
  update: async (id: string, input: UpdateTransferInput): Promise<TransferDto> =>
    parse(
      await client.fetch(`/transfers/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      TransferDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/transfers/${id}`, { method: 'DELETE' }), noContent),
});
