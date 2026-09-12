import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { TransferDeps } from './create-transfer.js';
import { latestEntriesOf } from './update-transfer.js';

export const deleteTransfer =
  (deps: TransferDeps) =>
  (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> =>
    deps.uow(async (repos) => {
      const current = await repos.transfers.findById(userId, id);
      if (!current) return err(new NotFoundError('transfer'));
      await repos.accounts.lock(userId, [current.fromAccountId, current.toAccountId]);
      const latest = await latestEntriesOf(repos, userId, current);
      if (latest.isErr()) return err(latest.error);
      await repos.balances.deleteByTransfer(userId, id);
      await repos.transfers.delete(userId, id);
      return ok(undefined);
    });
