import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { IncomeSourceDeps } from './create-income-source.js';

export const deleteIncomeSource =
  (deps: IncomeSourceDeps) =>
  (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> =>
    // Counting and deleting share one transaction (the pg repository locks the row first),
    // so an inflow racing the delete answers 409 instead of tripping the foreign key.
    deps.uow(async (repos) => {
      const outcome = await repos.incomeSources.delete(userId, id);
      if (outcome === 'not_found') return err(new NotFoundError('income source'));
      if (outcome === 'has_inflows')
        return err(
          new ConflictError(
            'source_has_inflows',
            'End the source instead (set activeTo): it has inflows',
          ),
        );
      return ok(undefined);
    });
