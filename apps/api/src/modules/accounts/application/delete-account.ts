import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';

export const deleteAccount =
  (deps: AccountDeps) =>
  (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> =>
    // Counting transfers and deleting the row are one transaction with the row
    // locked first, so a transfer racing the delete answers 409 (or 404 once the
    // delete has committed) instead of tripping the foreign key with a 500.
    deps.uow(async (repos) => {
      const [row] = await repos.accounts.lock(userId, [id]);
      if (!row) return err(new NotFoundError('account'));
      const outcome = await repos.accounts.delete(userId, id);
      if (outcome === 'not_found') return err(new NotFoundError('account'));
      if (outcome === 'has_transfers')
        return err(
          new ConflictError(
            'account_has_transfers',
            'Archive the account instead: it has transfers',
          ),
        );
      if (outcome === 'has_inflows')
        return err(
          new ConflictError(
            'account_has_inflows',
            'Archive the account instead: inflows were credited to it',
          ),
        );
      return ok(undefined);
    });
