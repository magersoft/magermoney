import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { CreateTransferInput, UpdateTransferInput } from '@magermoney/contracts';
import { ACCOUNTS_KEY } from '@/modules/accounts';
import { useApi } from '@/shared/api/use-api';
import { transfersApi } from '../infrastructure/transfers-api';

/** A transfer changes two balances and two journals, so everything account-shaped is refetched. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
      qc.invalidateQueries({ queryKey: ['transfers'] }),
    ]);
}

export function useCreateTransfer() {
  const api = transfersApi(useApi());
  const invalidate = useInvalidateAll();
  const m = useMutation({ mutationFn: api.create, onSettled: invalidate });
  return { create: (input: CreateTransferInput) => m.mutateAsync(input), isPending: m.isPending };
}
export function useUpdateTransfer() {
  const api = transfersApi(useApi());
  const invalidate = useInvalidateAll();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTransferInput }) =>
      api.update(id, input),
    onSettled: invalidate,
  });
  return {
    update: (id: string, input: UpdateTransferInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}
export function useDeleteTransfer() {
  const api = transfersApi(useApi());
  const invalidate = useInvalidateAll();
  const m = useMutation({ mutationFn: api.remove, onSettled: invalidate });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
