import { computed } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { CreateInflowInput, InflowDto, UpdateInflowInput } from '@magermoney/contracts';
import { settledOrParked } from '@/shared/api/offline-write';
import { useApi, useOwnerId } from '@/shared/api/use-api';
import { inflowsApi } from '../infrastructure/inflows-api';
import { invalidateAfterInflow } from './invalidate';
import {
  CREATE_INFLOW_KEY,
  registerIncomeMutations,
  type CreateInflowVars,
} from './mutation-defaults';

/**
 * What recording an inflow does — the POST, the optimistic receipt and balance,
 * the rollback — lives in the client's mutation defaults, so one that paused
 * offline and was restored from IndexedDB behaves exactly like one this screen
 * started.
 */
export function useCreateInflow() {
  const qc = useQueryClient();
  const ownerId = useOwnerId();
  registerIncomeMutations(qc, useApi(), ownerId);
  const m = useMutation<InflowDto, Error, CreateInflowVars>({ mutationKey: CREATE_INFLOW_KEY });
  return {
    /** Resolves `'parked'` when the write is waiting for a connection, so the sheet can close. */
    create: (input: CreateInflowInput) =>
      settledOrParked(m.mutateAsync({ ownerId: ownerId(), input }), m.isPaused),
    // A parked write is not pending on anything the person should wait for.
    isPending: computed(() => m.isPending.value && !m.isPaused.value),
  };
}

export function useUpdateInflow() {
  const api = inflowsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInflowInput; accountIds: string[] }) =>
      api.update(id, input),
    onSettled: (_d, _e, { accountIds }) => invalidateAfterInflow(qc, accountIds),
  });
  return {
    update: (id: string, input: UpdateInflowInput, accountIds: string[]) =>
      m.mutateAsync({ id, input, accountIds }),
    isPending: m.isPending,
  };
}

export function useDeleteInflow() {
  const api = inflowsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id }: { id: string; accountIds: string[] }) => api.remove(id),
    onSettled: (_d, _e, { accountIds }) => invalidateAfterInflow(qc, accountIds),
  });
  return {
    remove: (id: string, accountIds: string[]) => m.mutateAsync({ id, accountIds }),
    isPending: m.isPending,
  };
}
