import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError, type Clock, type CurrencyLookup } from '@magermoney/domain';
import type { ExpenseDto, ExpenseInput, UpdateExpenseInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import { toExpenseDto } from './dto.js';
import type { ExpensePatch, NewExpense } from './expense-repository.js';

export interface ExpenseDeps {
  /** The category may be created together with the expense, so both writes share a transaction. */
  uow: UnitOfWork<Repos>;
  repos: Pick<Repos, 'expenseCategories' | 'expenses'>;
  registry: CurrencyLookup;
  clock: Clock;
}
export type ExpenseFailure = NotFoundError | ValidationError | UnknownCurrencyError;

type ExpenseShape = Pick<
  NewExpense,
  'amount' | 'currency' | 'period' | 'billingMonth' | 'activeFrom' | 'activeTo'
>;

/** Everything that can be wrong with an expense without asking the database. Runs on the merged row for a PATCH. */
function checkShape(deps: ExpenseDeps, e: ExpenseShape): Result<true, ExpenseFailure> {
  if (!deps.registry.has(e.currency)) return err(new UnknownCurrencyError(e.currency));
  if (e.amount.trim().startsWith('-'))
    return err(new ValidationError('An expense cannot be negative', 'negative_amount'));
  if (e.billingMonth !== null && e.period !== 'yearly')
    return err(
      new ValidationError(
        'billingMonth is only meaningful for a yearly expense',
        'billing_month_requires_yearly',
      ),
    );
  if (e.activeTo !== null && e.activeTo < e.activeFrom)
    return err(new ValidationError('activeTo is before activeFrom', 'active_period_invalid'));
  return ok(true);
}

type CategoryRef = { categoryId?: string | undefined; categoryName?: string | undefined };

/** `null` when the input names no category at all (a PATCH that leaves it alone). */
async function resolveCategory(
  repos: Repos,
  userId: string,
  ref: CategoryRef,
): Promise<Result<string | null, NotFoundError | ValidationError>> {
  if (ref.categoryId !== undefined && ref.categoryName !== undefined)
    return err(
      new ValidationError('Send categoryId or categoryName, not both', 'category_ambiguous'),
    );
  if (ref.categoryId !== undefined) {
    const found = await repos.expenseCategories.findById(userId, ref.categoryId);
    return found ? ok(found.id) : err(new NotFoundError('category'));
  }
  if (ref.categoryName === undefined) return ok(null);
  const name = ref.categoryName.trim();
  const existing = await repos.expenseCategories.findByName(userId, name);
  if (existing) return ok(existing.id);
  const sortOrder = (await repos.expenseCategories.list(userId)).length;
  const created = await repos.expenseCategories.insert(userId, { name, icon: null, sortOrder });
  if (created !== 'name_taken') return ok(created.id);
  // Lost a race with a parallel request that created the same name: use theirs.
  const winner = await repos.expenseCategories.findByName(userId, name);
  return winner ? ok(winner.id) : err(new NotFoundError('category'));
}

export const createExpense =
  (deps: ExpenseDeps) =>
  (userId: string, input: ExpenseInput): Promise<Result<ExpenseDto, ExpenseFailure>> =>
    deps.uow(async (repos) => {
      const shape: Omit<NewExpense, 'categoryId'> = {
        name: input.name.trim(),
        amount: input.amount,
        currency: input.currency,
        period: input.period,
        billingDay: input.billingDay ?? null,
        billingMonth: input.billingMonth ?? null,
        isEssential: input.isEssential ?? false,
        activeFrom: input.activeFrom ?? deps.clock.today(),
        activeTo: input.activeTo ?? null,
      };
      // Validate before touching the category, so a rejected expense leaves no orphan category behind.
      const checked = checkShape(deps, shape);
      if (checked.isErr()) return err(checked.error);
      const category = await resolveCategory(repos, userId, input);
      if (category.isErr()) return err(category.error);
      if (category.value === null)
        return err(
          new ValidationError('categoryId or categoryName is required', 'category_required'),
        );
      const row = await repos.expenses.insert(userId, { ...shape, categoryId: category.value });
      return ok(toExpenseDto(row));
    });

export const updateExpense =
  (deps: ExpenseDeps) =>
  (
    userId: string,
    id: string,
    input: UpdateExpenseInput,
  ): Promise<Result<ExpenseDto, ExpenseFailure>> =>
    deps.uow(async (repos) => {
      const current = await repos.expenses.findById(userId, id);
      if (!current) return err(new NotFoundError('expense'));
      const patch: ExpensePatch = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.amount !== undefined) patch.amount = input.amount;
      if (input.currency !== undefined) patch.currency = input.currency;
      if (input.period !== undefined) patch.period = input.period;
      if (input.billingDay !== undefined) patch.billingDay = input.billingDay;
      if (input.billingMonth !== undefined) patch.billingMonth = input.billingMonth;
      if (input.isEssential !== undefined) patch.isEssential = input.isEssential;
      if (input.activeFrom !== undefined) patch.activeFrom = input.activeFrom;
      if (input.activeTo !== undefined) patch.activeTo = input.activeTo;
      const checked = checkShape(deps, { ...current, ...patch });
      if (checked.isErr()) return err(checked.error);
      const category = await resolveCategory(repos, userId, input);
      if (category.isErr()) return err(category.error);
      if (category.value !== null) patch.categoryId = category.value;
      const row = await repos.expenses.update(userId, id, patch);
      return row ? ok(toExpenseDto(row)) : err(new NotFoundError('expense'));
    });
