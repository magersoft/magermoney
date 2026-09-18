import { err, ok, type Result } from 'neverthrow';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { InflowDeps } from './create-inflow.js';

export const deleteInflow =
  (deps: InflowDeps) =>
  (userId: string, id: string): Promise<Result<void, NotFoundError | ConflictError>> =>
    deps.uow(async (repos) =>
      (await repos.inflows.delete(userId, id)) ? ok(undefined) : err(new NotFoundError('inflow')),
    );
