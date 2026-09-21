import { err, ok, type Result } from 'neverthrow';
import type { Clock } from '@magermoney/domain';
import type { ValuationDto, ValuationInput, UpdateValuationInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import { toValuationDto } from './dto.js';
import type { ValuationPatch } from './valuation-repository.js';

export interface ValuationDeps {
  repos: Pick<Repos, 'assets' | 'valuations'>;
  clock: Clock;
}
export type ValuationFailure = NotFoundError | ConflictError;

const DUPLICATE = new ConflictError(
  'valuation_exists',
  'That asset already carries a valuation for that day',
);

/** 404s rather than serving an empty journal for an asset that is not the user's. */
export const listValuations =
  (deps: ValuationDeps) =>
  async (userId: string, assetId: string): Promise<Result<ValuationDto[], NotFoundError>> => {
    if (!(await deps.repos.assets.findById(userId, assetId)))
      return err(new NotFoundError('asset'));
    return ok((await deps.repos.valuations.list(userId, assetId)).map(toValuationDto));
  };

export const addValuation =
  (deps: ValuationDeps) =>
  async (
    userId: string,
    assetId: string,
    input: ValuationInput,
  ): Promise<Result<ValuationDto, ValuationFailure>> => {
    if (!(await deps.repos.assets.findById(userId, assetId)))
      return err(new NotFoundError('asset'));
    const row = await deps.repos.valuations.insert(userId, {
      assetId,
      value: input.value,
      valuedOn: input.valuedOn ?? deps.clock.today(),
    });
    return row ? ok(toValuationDto(row)) : err(DUPLICATE);
  };

export const updateValuation =
  (deps: ValuationDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateValuationInput,
  ): Promise<Result<ValuationDto, ValuationFailure>> => {
    if (!(await deps.repos.valuations.findById(userId, id)))
      return err(new NotFoundError('valuation'));
    const patch: ValuationPatch = {};
    if (input.value !== undefined) patch.value = input.value;
    if (input.valuedOn !== undefined) patch.valuedOn = input.valuedOn;
    const row = await deps.repos.valuations.update(userId, id, patch);
    return row ? ok(toValuationDto(row)) : err(DUPLICATE);
  };

export const deleteValuation =
  (deps: ValuationDeps) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError>> =>
    (await deps.repos.valuations.delete(userId, id))
      ? ok(undefined)
      : err(new NotFoundError('valuation'));
