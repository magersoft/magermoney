import { err, ok, type Result } from 'neverthrow';
import { ValidationError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';

export const reorderAccounts =
  (deps: AccountDeps) =>
  async (userId: string, ids: string[]): Promise<Result<void, ValidationError>> =>
    (await deps.repos.accounts.reorder(userId, ids))
      ? ok(undefined)
      : err(new ValidationError('Every id must be one of your accounts', 'unknown_account'));
