import { err, ok, type Result } from 'neverthrow';
import {
  Decimal,
  UnknownCurrencyError,
  type Clock,
  type CurrencyRegistry,
} from '@magermoney/domain';
import type { IncomeSourceDto, IncomeSourceInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import { toIncomeSourceDto } from './dto.js';
import type { NewIncomeSource } from './income-source-repository.js';

export interface IncomeSourceDeps {
  /** The primary flag moves between rows, so create and update run inside one transaction. */
  uow: UnitOfWork<Repos>;
  repos: Repos;
  registry: CurrencyRegistry;
  clock: Clock;
}
export type IncomeSourceFailure =
  NotFoundError | ValidationError | ConflictError | UnknownCurrencyError;

const isFraction = (raw: string) => {
  const v = new Decimal(raw);
  return v.gte(0) && v.lt(1);
};

/**
 * The rules the database also enforces, answered as 400s with a code instead
 * of a constraint violation. Pay days come back unique and ascending.
 */
export function validateSource(
  data: NewIncomeSource,
  registry: CurrencyRegistry,
): Result<NewIncomeSource, ValidationError | UnknownCurrencyError> {
  if (!registry.has(data.currency)) return err(new UnknownCurrencyError(data.currency));
  if (new Decimal(data.grossAmount).isNegative())
    return err(new ValidationError('The gross amount cannot be negative', 'negative_amount'));
  if (!isFraction(data.taxRate) || !isFraction(data.commissionRate))
    return err(
      new ValidationError('Tax and commission are fractions from 0 up to 1', 'rate_out_of_range'),
    );
  if (data.payDays.some((d) => !Number.isInteger(d) || d < 1 || d > 31))
    return err(new ValidationError('Pay days are days of the month, 1 to 31', 'pay_days_invalid'));
  if (data.activeTo !== null && data.activeTo < data.activeFrom)
    return err(
      new ValidationError('The active period cannot end before it starts', 'active_period_invalid'),
    );
  return ok({ ...data, payDays: [...new Set(data.payDays)].sort((a, b) => a - b) });
}

export async function assertDefaultAccount(
  repos: Pick<Repos, 'accounts'>,
  userId: string,
  accountId: string | null,
): Promise<Result<void, ValidationError>> {
  if (accountId !== null && !(await repos.accounts.findById(userId, accountId)))
    return err(
      new ValidationError('The default account was not found', 'default_account_not_found'),
    );
  return ok(undefined);
}

const toNew = (input: IncomeSourceInput, today: string): NewIncomeSource => ({
  name: input.name,
  grossAmount: input.grossAmount,
  currency: input.currency,
  taxRate: input.taxRate ?? '0',
  commissionRate: input.commissionRate ?? '0',
  payDays: input.payDays ?? [],
  isPrimary: input.isPrimary ?? false,
  // Optional in the contract: a source added without a start date starts today.
  activeFrom: input.activeFrom ?? today,
  activeTo: input.activeTo ?? null,
  defaultAccountId: input.defaultAccountId ?? null,
});

export const createIncomeSource =
  (deps: IncomeSourceDeps) =>
  (
    userId: string,
    input: IncomeSourceInput,
  ): Promise<Result<IncomeSourceDto, IncomeSourceFailure>> =>
    deps.uow(async (repos) => {
      // First statement of the transaction: two writers claiming the primary flag queue up here.
      if (input.isPrimary === true) await repos.incomeSources.lockAll(userId);
      const data = validateSource(toNew(input, deps.clock.today()), deps.registry);
      if (data.isErr()) return err(data.error);
      const account = await assertDefaultAccount(repos, userId, data.value.defaultAccountId);
      if (account.isErr()) return err(account.error);
      if (data.value.isPrimary) await repos.incomeSources.clearPrimary(userId);
      const row = await repos.incomeSources.insert(userId, data.value);
      return ok(toIncomeSourceDto(row, deps.registry));
    });
