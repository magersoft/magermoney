import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';
import { assertEditable } from './edit-balance.js';

export const deleteBalance =
  (deps: AccountDeps) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> => {
    const entry = await deps.repos.balances.findById(userId, id);
    if (!entry) return err(new NotFoundError('balance entry'));
    const editable = await assertEditable(deps.repos, userId, entry);
    if (editable.isErr()) return err(editable.error);
    await deps.repos.balances.delete(userId, id);
    return ok(undefined);
  };
