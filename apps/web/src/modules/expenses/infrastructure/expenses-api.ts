import {
  ExpenseCategoryDtoSchema,
  ExpenseDtoSchema,
  type ExpenseCategoryDto,
  type ExpenseDto,
  type ExpenseInput,
  type UpdateExpenseInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const expenseList = listOf(ExpenseDtoSchema);
const categoryList = listOf(ExpenseCategoryDtoSchema);
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

export const expensesApi = (client: ApiClient) => ({
  list: async (): Promise<ExpenseDto[]> =>
    parse(await client.fetch('/expenses', { method: 'GET' }), expenseList),
  categories: async (): Promise<ExpenseCategoryDto[]> =>
    parse(await client.fetch('/expense-categories', { method: 'GET' }), categoryList),
  create: async (input: ExpenseInput): Promise<ExpenseDto> =>
    parse(
      await client.fetch('/expenses', { method: 'POST', body: JSON.stringify(input) }),
      ExpenseDtoSchema,
    ),
  update: async (id: string, input: UpdateExpenseInput): Promise<ExpenseDto> =>
    parse(
      await client.fetch(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      ExpenseDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/expenses/${id}`, { method: 'DELETE' }), noContent),
});
