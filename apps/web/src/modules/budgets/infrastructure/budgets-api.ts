import {
  BudgetDtoSchema,
  type BudgetDto,
  type BudgetInput,
  type UpdateBudgetInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const list = listOf(BudgetDtoSchema);
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

export const budgetsApi = (client: ApiClient) => ({
  list: async (): Promise<BudgetDto[]> =>
    parse(await client.fetch('/budgets', { method: 'GET' }), list),
  create: async (input: BudgetInput): Promise<BudgetDto> =>
    parse(
      await client.fetch('/budgets', { method: 'POST', body: JSON.stringify(input) }),
      BudgetDtoSchema,
    ),
  update: async (id: string, input: UpdateBudgetInput): Promise<BudgetDto> =>
    parse(
      await client.fetch(`/budgets/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      BudgetDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/budgets/${id}`, { method: 'DELETE' }), noContent),
});
