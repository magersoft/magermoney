import { err, ok, type Result } from 'neverthrow';
import { Decimal, UnknownCurrencyError, type Clock, type CurrencyLookup } from '@magermoney/domain';
import type { GoalDto, GoalInput, UpdateGoalInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { GoalPatch, NewGoal } from './goal-repository.js';
import { toGoalDto } from './dto.js';

export interface GoalDeps {
  repos: Pick<Repos, 'goals' | 'accounts'>;
  registry: CurrencyLookup;
  clock: Clock;
  uow: UnitOfWork<Repos>;
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

export const getGoal =
  (deps: GoalDeps) =>
  async (userId: string, id: string): Promise<Result<GoalDto, NotFoundError>> => {
    const row = await deps.repos.goals.findById(userId, id);
    return row ? ok(toGoalDto(row)) : err(new NotFoundError('goal'));
  };

export const createGoal =
  (deps: GoalDeps) =>
  async (userId: string, input: GoalInput): Promise<Result<GoalDto, GoalFailure>> => {
    const data: NewGoal = {
      name: input.name.trim(),
      icon: input.icon ?? null,
      color: input.color ?? null,
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

const toPatch = (input: UpdateGoalInput): GoalPatch => {
  const patch: GoalPatch = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;
  if (input.targetAmount !== undefined) patch.targetAmount = input.targetAmount;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.targetDate !== undefined) patch.targetDate = input.targetDate;
  if (input.achievedAt !== undefined) patch.achievedAt = input.achievedAt;
  if (input.archivedAt !== undefined) patch.archivedAt = input.archivedAt;
  return patch;
};

/**
 * Archiving is the one place a Goal writes outside its own table. The stamp and
 * the release belong to one decision, so they belong to one transaction: split
 * across two, an interrupted request leaves an archived Goal whose Accounts
 * still believe they are taken, and they never appear in the "free accounts"
 * list again.
 */
export const updateGoal =
  (deps: GoalDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateGoalInput,
  ): Promise<Result<GoalDto, GoalFailure>> => {
    const current = await deps.repos.goals.findById(userId, id);
    if (!current) return err(new NotFoundError('goal'));
    const patch = toPatch(input);
    const checked = checkShape(deps, { ...current, ...patch });
    if (checked.isErr()) return err(checked.error);

    const isArchiving = patch.archivedAt != null && current.archivedAt === null;
    if (!isArchiving) {
      const row = await deps.repos.goals.update(userId, id, patch);
      return row ? ok(toGoalDto(row)) : err(new NotFoundError('goal'));
    }
    const row = await deps.uow(async (repos) => {
      const updated = await repos.goals.update(userId, id, patch);
      await repos.accounts.clearGoal(userId, id);
      return updated;
    });
    return row ? ok(toGoalDto(row)) : err(new NotFoundError('goal'));
  };

/**
 * Called after any write that can change what a Goal holds. It only ever writes
 * the stamp, and only when it is absent: a rate moving back down must not undo
 * a goal the owner has already celebrated.
 *
 * The funded amount must already be in the Goal's own currency — the API has no
 * rate table in a request path and never guesses one.
 */
export const stampAchieved =
  (deps: GoalDeps) =>
  async (userId: string, goalId: string, funded: Decimal): Promise<void> => {
    const goal = await deps.repos.goals.findById(userId, goalId);
    if (!goal || goal.achievedAt !== null) return;
    if (funded.lt(new Decimal(goal.targetAmount))) return;
    await deps.repos.goals.update(userId, goalId, { achievedAt: deps.clock.now().toISOString() });
  };

/** Deleting a goal releases its accounts: the foreign key nulls `goal_id`. */
export const deleteGoal =
  (deps: GoalDeps) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError>> =>
    (await deps.repos.goals.delete(userId, id)) ? ok(undefined) : err(new NotFoundError('goal'));
