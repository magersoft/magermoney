import { err, ok, type Result } from 'neverthrow';
import type { Repos } from '../../../app.js';
import { NotFoundError } from '../../../shared/errors/http.js';

/** Expenses carry no history in phase 3, so deleting one is unconditional. Ending it is a PATCH of activeTo. */
export const deleteExpense =
  (repos: Pick<Repos, 'expenses'>) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError>> =>
    (await repos.expenses.delete(userId, id)) ? ok(undefined) : err(new NotFoundError('expense'));
