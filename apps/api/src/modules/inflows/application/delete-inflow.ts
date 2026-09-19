import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { InflowDeps } from './create-inflow.js';
import { assertInflowLatest } from './credit.js';

export const deleteInflow =
  (deps: InflowDeps) =>
  (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> =>
    deps.uow(async (repos) => {
      const existing = await repos.inflows.findById(userId, id);
      if (!existing) return err(new NotFoundError('inflow'));
      if (existing.accountId !== null) {
        await repos.accounts.lock(userId, [existing.accountId]);
        // Re-read once the lock is held: whatever was written in between is visible now.
        const current = await repos.inflows.findById(userId, id);
        if (!current) return err(new NotFoundError('inflow'));
        if (current.accountId !== null) {
          const latest = await assertInflowLatest(repos, userId, current);
          if (latest.isErr()) return err(latest.error);
          // The account's previous entry becomes its balance again.
          await repos.balances.deleteByInflow(userId, id);
        }
      }
      return (await repos.inflows.delete(userId, id))
        ? ok(undefined)
        : err(new NotFoundError('inflow'));
    });
