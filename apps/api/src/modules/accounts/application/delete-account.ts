import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';

export const deleteAccount =
  (deps: AccountDeps) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> => {
    const outcome = await deps.repos.accounts.delete(userId, id);
    if (outcome === 'not_found') return err(new NotFoundError('account'));
    if (outcome === 'has_transfers')
      return err(
        new ConflictError('account_has_transfers', 'Archive the account instead: it has transfers'),
      );
    return ok(undefined);
  };
