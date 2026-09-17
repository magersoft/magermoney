import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';
import { assertEditable } from './edit-balance.js';

export const deleteBalance =
  (deps: AccountDeps) =>
  (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> =>
    // Same lock as `editBalance`: "is this still the latest entry" is only true
    // for as long as the account row is held.
    deps.uow(async (repos) => {
      const found = await repos.balances.findById(userId, id);
      if (!found) return err(new NotFoundError('balance entry'));
      await repos.accounts.lock(userId, [found.accountId]);
      const entry = await repos.balances.findById(userId, id);
      if (!entry) return err(new NotFoundError('balance entry'));
      const editable = await assertEditable(repos, userId, entry);
      if (editable.isErr()) return err(editable.error);
      await repos.balances.delete(userId, id);
      return ok(undefined);
    });
