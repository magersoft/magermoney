import type { TransferDto, TransfersQuery } from '@magermoney/contracts';
import type { TransferDeps } from './create-transfer.js';
import { toTransferDto } from './dto.js';

export const listTransfers =
  (deps: TransferDeps) =>
  async (userId: string, query: TransfersQuery): Promise<TransferDto[]> => {
    const [rows, accounts] = await Promise.all([
      deps.repos.transfers.list(userId, query.limit, query.before, query.accountId),
      deps.repos.accounts.list(userId),
    ]);
    const currencyOf = (id: string) =>
      deps.registry
        .get(accounts.find((a) => a.id === id)?.currency ?? '')
        .unwrapOr({ code: '?', kind: 'fiat' as const, scale: 2 });
    return rows.map((r) =>
      toTransferDto(r, currencyOf(r.fromAccountId), currencyOf(r.toAccountId)),
    );
  };
