import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { GoalInput, UpdateGoalInput } from '@magermoney/contracts';
import { ACCOUNTS_KEY } from '@/modules/accounts';
import { useApi } from '@/shared/api/use-api';
import { goalsApi } from '../infrastructure/goals-api';
import { GOALS_KEY } from './use-goals';

export function useCreateGoal() {
  const api = goalsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.create,
    onSettled: () => qc.invalidateQueries({ queryKey: GOALS_KEY }),
  });
  return { create: (input: GoalInput) => m.mutateAsync(input), isPending: m.isPending };
}

export function useUpdateGoal() {
  const api = goalsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateGoalInput }) => api.update(id, input),
    /* Archiving releases the goal's accounts, so the accounts list is stale too. */
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: GOALS_KEY });
      await qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });
  return {
    update: (id: string, input: UpdateGoalInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

/** Archiving is an update, not a delete: the goal stays, and it releases its accounts. */
export function useArchiveGoal() {
  const { update, isPending } = useUpdateGoal();
  return {
    archive: (id: string) => update(id, { archivedAt: new Date().toISOString() }),
    isPending,
  };
}

export function useDeleteGoal() {
  const api = goalsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.remove,
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: GOALS_KEY });
      await qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
