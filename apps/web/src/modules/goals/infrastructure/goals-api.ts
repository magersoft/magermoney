import {
  GoalDtoSchema,
  type GoalDto,
  type GoalInput,
  type UpdateGoalInput,
} from '@magermoney/contracts';
import { listOf, parse, type ApiClient } from '@/shared/api/client';

const list = listOf(GoalDtoSchema);
const noContent = { safeParse: () => ({ success: true as const, data: undefined }) };

export const goalsApi = (client: ApiClient) => ({
  list: async (): Promise<GoalDto[]> =>
    parse(await client.fetch('/goals', { method: 'GET' }), list),
  create: async (input: GoalInput): Promise<GoalDto> =>
    parse(
      await client.fetch('/goals', { method: 'POST', body: JSON.stringify(input) }),
      GoalDtoSchema,
    ),
  update: async (id: string, input: UpdateGoalInput): Promise<GoalDto> =>
    parse(
      await client.fetch(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
      GoalDtoSchema,
    ),
  remove: async (id: string): Promise<void> =>
    parse(await client.fetch(`/goals/${id}`, { method: 'DELETE' }), noContent),
});
