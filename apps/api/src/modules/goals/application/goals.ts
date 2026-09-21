import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError, type CurrencyLookup } from '@magermoney/domain';
import type { GoalDto, GoalInput, UpdateGoalInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { GoalPatch, NewGoal } from './goal-repository.js';
import { toGoalDto } from './dto.js';

export interface GoalDeps {
  repos: Pick<Repos, 'goals'>;
  registry: CurrencyLookup;
}
export type GoalFailure = NotFoundError | ValidationError | UnknownCurrencyError;

type GoalShape = Pick<NewGoal, 'targetAmount' | 'currency'>;

function checkShape(deps: GoalDeps, g: GoalShape): Result<true, GoalFailure> {
  if (!deps.registry.has(g.currency)) return err(new UnknownCurrencyError(g.currency));
  const amount = g.targetAmount.trim();
  if (amount.startsWith('-') || /^0+(\.0+)?$/.test(amount))
    return err(new ValidationError('A goal must aim at more than nothing', 'non_positive_amount'));
  return ok(true);
}

/** Archived goals are part of the list: the client decides what it shows. */
export const listGoals =
  (deps: GoalDeps) =>
  async (userId: string): Promise<GoalDto[]> =>
    (await deps.repos.goals.list(userId)).map(toGoalDto);

export const createGoal =
  (deps: GoalDeps) =>
  async (userId: string, input: GoalInput): Promise<Result<GoalDto, GoalFailure>> => {
    const data: NewGoal = {
      name: input.name.trim(),
      icon: input.icon ?? null,
      targetAmount: input.targetAmount,
      currency: input.currency,
      targetDate: input.targetDate ?? null,
      achievedAt: null,
      archivedAt: null,
      sortOrder: 0,
    };
    const checked = checkShape(deps, data);
    if (checked.isErr()) return err(checked.error);
    return ok(toGoalDto(await deps.repos.goals.insert(userId, data)));
  };

export const updateGoal =
  (deps: GoalDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateGoalInput,
  ): Promise<Result<GoalDto, GoalFailure>> => {
    const current = await deps.repos.goals.findById(userId, id);
    if (!current) return err(new NotFoundError('goal'));
    const patch: GoalPatch = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.targetAmount !== undefined) patch.targetAmount = input.targetAmount;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.targetDate !== undefined) patch.targetDate = input.targetDate;
    if (input.achievedAt !== undefined) patch.achievedAt = input.achievedAt;
    // `archivedAt` is deliberately not patched here: archiving releases the
    // goal's accounts, which is a two-table write. `archiveGoal` owns it.
    const checked = checkShape(deps, { ...current, ...patch });
    if (checked.isErr()) return err(checked.error);
    const row = await deps.repos.goals.update(userId, id, patch);
    return row ? ok(toGoalDto(row)) : err(new NotFoundError('goal'));
  };

/** Deleting a goal releases its accounts: the foreign key nulls `goal_id`. */
export const deleteGoal =
  (deps: GoalDeps) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError>> =>
    (await deps.repos.goals.delete(userId, id)) ? ok(undefined) : err(new NotFoundError('goal'));
