import {
  IncomeSourceDtoSchema,
  type IncomeSourceDto,
  type IncomeSourceInput,
  type UpdateIncomeSourceInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const sourceList = listOf(IncomeSourceDtoSchema);
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

export const incomeSourcesApi = (client: ApiClient) => ({
  list: async (): Promise<IncomeSourceDto[]> =>
    parse(await client.fetch('/income-sources', { method: 'GET' }), sourceList),
  create: async (input: IncomeSourceInput): Promise<IncomeSourceDto> =>
    parse(
      await client.fetch('/income-sources', { method: 'POST', body: JSON.stringify(input) }),
      IncomeSourceDtoSchema,
    ),
  update: async (id: string, input: UpdateIncomeSourceInput): Promise<IncomeSourceDto> =>
    parse(
      await client.fetch(`/income-sources/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      IncomeSourceDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/income-sources/${id}`, { method: 'DELETE' }), noContent),
});
