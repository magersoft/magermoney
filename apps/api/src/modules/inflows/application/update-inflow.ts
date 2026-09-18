import { err, ok, type Result } from 'neverthrow';
import type { InflowDto, UpdateInflowInput } from '@magermoney/contracts';
import { NotFoundError } from '../../../shared/errors/http.js';
import { resolveInflow, type InflowDeps, type InflowFailure } from './create-inflow.js';
import { toInflowDto } from './dto.js';

const pick = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);

export const updateInflow =
  (deps: InflowDeps) =>
  (
    userId: string,
    id: string,
    input: UpdateInflowInput,
  ): Promise<Result<InflowDto, InflowFailure>> =>
    deps.uow(async (repos) => {
      const current = await repos.inflows.findById(userId, id);
      if (!current) return err(new NotFoundError('inflow'));
      const resolved = await resolveInflow(deps, repos, userId, {
        incomeSourceId: pick(input.incomeSourceId, current.incomeSourceId),
        amount: pick(input.amount, current.amount),
        // An inflow keeps its own currency when it moves to another source.
        currency: pick(input.currency, current.currency),
        receivedOn: pick(input.receivedOn, current.receivedOn),
        realisedRateToUsd: pick(input.realisedRateToUsd, current.realisedRateToUsd),
        note: pick(input.note, current.note),
      });
      if (resolved.isErr()) return err(resolved.error);
      const row = await repos.inflows.update(userId, id, {
        ...resolved.value.data,
        accountId: current.accountId,
        creditedAmount: current.creditedAmount,
      });
      return row ? ok(toInflowDto(row)) : err(new NotFoundError('inflow'));
    });
