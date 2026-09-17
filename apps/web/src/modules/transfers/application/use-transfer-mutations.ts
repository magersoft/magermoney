import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { CreateTransferInput, TransferDto, UpdateTransferInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { transfersApi } from '../infrastructure/transfers-api';
import {
  CREATE_TRANSFER_KEY,
  invalidateAfterTransfer,
  registerTransferMutations,
} from './mutation-defaults';

/** A transfer changes two balances and two journals, so everything account-shaped is refetched. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => invalidateAfterTransfer(qc);
}

/**
 * What a new transfer does lives in the client's mutation defaults, so one made
 * offline can be restored from IndexedDB and replayed without this screen.
 */
export function useCreateTransfer() {
  const qc = useQueryClient();
  registerTransferMutations(qc, useApi());
  const m = useMutation<TransferDto, Error, CreateTransferInput>({
    mutationKey: CREATE_TRANSFER_KEY,
  });
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
