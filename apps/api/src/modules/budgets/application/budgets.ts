import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError, type Clock, type CurrencyLookup } from '@magermoney/domain';
import type { BudgetDto, BudgetInput, UpdateBudgetInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { BudgetPatch, NewBudget } from './budget-repository.js';
import { toBudgetDto } from './dto.js';

export interface BudgetDeps {
  repos: Pick<Repos, 'budgets'>;
  registry: CurrencyLookup;
  clock: Clock;
}
export type BudgetFailure = NotFoundError | ValidationError | UnknownCurrencyError;

type BudgetShape = Pick<NewBudget, 'monthlyLimit' | 'currency' | 'activeFrom' | 'activeTo'>;

function checkShape(deps: BudgetDeps, b: BudgetShape): Result<true, BudgetFailure> {
  if (!deps.registry.has(b.currency)) return err(new UnknownCurrencyError(b.currency));
  if (b.monthlyLimit.trim().startsWith('-'))
    return err(new ValidationError('A budget limit cannot be negative', 'negative_amount'));
  if (b.activeTo !== null && b.activeTo < b.activeFrom)
    return err(new ValidationError('activeTo is before activeFrom', 'active_period_invalid'));
  return ok(true);
}

/** Ended budgets are part of the list: the client decides what "active today" means. */
export const listBudgets =
  (deps: BudgetDeps) =>
  async (userId: string): Promise<BudgetDto[]> =>
    (await deps.repos.budgets.list(userId)).map(toBudgetDto);

export const createBudget =
  (deps: BudgetDeps) =>
  async (userId: string, input: BudgetInput): Promise<Result<BudgetDto, BudgetFailure>> => {
    const data: NewBudget = {
      name: input.name.trim(),
      icon: input.icon ?? null,
      monthlyLimit: input.monthlyLimit,
      currency: input.currency,
      activeFrom: input.activeFrom ?? deps.clock.today(),
      activeTo: input.activeTo ?? null,
    };
    const checked = checkShape(deps, data);
    if (checked.isErr()) return err(checked.error);
    return ok(toBudgetDto(await deps.repos.budgets.insert(userId, data)));
  };

export const updateBudget =
  (deps: BudgetDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateBudgetInput,
  ): Promise<Result<BudgetDto, BudgetFailure>> => {
    const current = await deps.repos.budgets.findById(userId, id);
    if (!current) return err(new NotFoundError('budget'));
    const patch: BudgetPatch = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.monthlyLimit !== undefined) patch.monthlyLimit = input.monthlyLimit;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.activeFrom !== undefined) patch.activeFrom = input.activeFrom;
    if (input.activeTo !== undefined) patch.activeTo = input.activeTo;
    const checked = checkShape(deps, { ...current, ...patch });
    if (checked.isErr()) return err(checked.error);
    const row = await deps.repos.budgets.update(userId, id, patch);
    return row ? ok(toBudgetDto(row)) : err(new NotFoundError('budget'));
  };

/** No spends exist before phase 5, so nothing can refer to a budget yet. */
export const deleteBudget =
  (deps: BudgetDeps) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError>> =>
    (await deps.repos.budgets.delete(userId, id))
      ? ok(undefined)
      : err(new NotFoundError('budget'));
