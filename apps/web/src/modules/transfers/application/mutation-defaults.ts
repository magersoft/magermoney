import type { QueryClient } from '@tanstack/vue-query';
import type { CreateTransferInput, TransferDto } from '@magermoney/contracts';
import { ACCOUNTS_KEY } from '@/modules/accounts';
import type { ApiClient } from '@/shared/api/client';
import { assertOwner } from '@/shared/api/offline-write';
import { transfersApi } from '../infrastructure/transfers-api';
import { TRANSFERS_KEY } from './use-transfers';

/** Creating a transfer survives a closed tab the same way recording a balance does. */
export const CREATE_TRANSFER_KEY = ['transfers', 'create'] as const;

export interface CreateTransferVars {
  /** Who made the transfer; checked against the session before it is sent, never part of the body. */
  ownerId: string | null;
  input: CreateTransferInput;
}

/** A transfer changes two balances and two journals, so everything account-shaped is refetched. */
export const invalidateAfterTransfer = (queryClient: QueryClient): Promise<unknown> =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
    queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY }),
  ]);

/**
 * Registers what a `createTransfer` mutation does on the given client. Called by
 * the composition root at start-up and again by the composable, so a restored
 * mutation and a fresh one run the same code.
 */
export function registerTransferMutations(
  queryClient: QueryClient,
  client: ApiClient,
  signedInId: () => string | null = () => null,
): void {
  const api = transfersApi(client);
  queryClient.setMutationDefaults(CREATE_TRANSFER_KEY, {
    // The owner id decides whether the transfer may be sent; the body is the input alone.
    mutationFn: ({ ownerId, input }: CreateTransferVars): Promise<TransferDto> => {
      assertOwner(ownerId, signedInId());
      return api.create(input);
    },
    onSettled: (): Promise<unknown> => invalidateAfterTransfer(queryClient),
  });
}
