import { err, ok, type Result } from 'neverthrow';
import { Decimal, UnknownCurrencyError } from '@magermoney/domain';
import type { AccountDto, UpdateAccountInput } from '@magermoney/contracts';
import { stampAchieved } from '../../goals/application/goals.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { AccountPatch } from './account-repository.js';
import type { AccountDeps } from './create-account.js';
import { toAccountDto } from './dto.js';

const CARD_NULLS: AccountPatch = {
  cardType: null,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
};

export const updateAccount =
  (deps: AccountDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateAccountInput,
  ): Promise<Result<AccountDto, NotFoundError | ConflictError | UnknownCurrencyError>> => {
    const current = await deps.repos.accounts.findById(userId, id);
    if (!current) return err(new NotFoundError('account'));
    if (input.currency !== undefined && !deps.registry.has(input.currency))
      return err(new UnknownCurrencyError(input.currency));
    if (
      input.currency !== undefined &&
      input.currency !== current.currency &&
      (await deps.repos.accounts.countEntries(userId, id)) > 0
    )
      return err(
        new ConflictError(
          'account_has_history',
          'The currency cannot change once balances are recorded',
        ),
      );
    if (input.goalId !== undefined && input.goalId !== null) {
      const goal = await deps.repos.goals.findById(userId, input.goalId);
      if (!goal) return err(new NotFoundError('goal'));
      if (goal.archivedAt !== null)
        return err(new ConflictError('goal_archived', 'That goal is archived'));
      if (current.goalId !== null && current.goalId !== input.goalId)
        return err(
          new ConflictError('account_already_linked', 'That account already funds another goal'),
        );
    }
    const kind = input.kind ?? current.kind;
    const patch = { ...input, ...(kind === 'card' ? {} : CARD_NULLS) } as AccountPatch;
    const row = await deps.repos.accounts.update(userId, id, patch);
    if (!row) return err(new NotFoundError('account'));
    if (input.goalId) await stampFromSameCurrency(deps)(userId, input.goalId);
    return ok(toAccountDto(row));
  };

/**
 * A Goal is stamped as achieved on the strength of the Accounts that hold its
 * own currency, and those alone. Converting the others would need a rate table,
 * which no request path here has — and a stamp that depends on today's rate is
 * a stamp that a rate could take back. A Goal funded entirely in other
 * currencies is stamped by the next same-currency write, or by its owner.
 */
const stampFromSameCurrency =
  (deps: AccountDeps) =>
  async (userId: string, goalId: string): Promise<void> => {
    const goal = await deps.repos.goals.findById(userId, goalId);
    if (!goal || goal.achievedAt !== null) return;
    const linked = await deps.repos.accounts.listByGoal(userId, goalId);
    const funded = linked
      .filter((a) => a.currency === goal.currency)
      .reduce((sum, a) => sum.plus(new Decimal(a.balance ?? '0')), new Decimal(0));
    await stampAchieved({
      repos: deps.repos,
      registry: deps.registry,
      clock: deps.clock,
      uow: deps.uow,
    })(userId, goalId, funded);
  };
