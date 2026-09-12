import { err, ok, type Result } from 'neverthrow';
import type { DeleteManualRateQuery } from '@magermoney/contracts';
import { NotFoundError } from '../../../shared/errors/http.js';
import type { RateRepository } from './rate-repository.js';

export const removeManualRate =
  (repo: RateRepository) =>
  async (userId: string, q: DeleteManualRateQuery): Promise<Result<void, NotFoundError>> =>
    (await repo.deleteManual(userId, q.base, q.date))
      ? ok(undefined)
      : err(new NotFoundError('manual rate'));
