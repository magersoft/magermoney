import { err, ok, type Result } from 'neverthrow';
import {
  Decimal,
  Money,
  type Clock,
  type Currency,
  type CurrencyMismatchError,
  type CurrencyRegistry,
  type InflowError,
  type UnknownCurrencyError,
} from '@magermoney/domain';
import type { CreateInflowInput, InflowDto } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import {
  freshTarget,
  planCredit,
  writeCredit,
  type CreditPlan,
  type CreditTarget,
} from './credit.js';
import { toInflowDto } from './dto.js';
import type { NewInflow } from './inflow-repository.js';

export type InflowFailure =
  | NotFoundError
  | ValidationError
  | ConflictError
  | UnknownCurrencyError
  | InflowError
  | CurrencyMismatchError;

export const creditedWithoutAccount = () =>
  new ValidationError(
    'A credited amount needs the account it landed on',
    'credited_without_account',
  );

export interface InflowDeps {
  uow: UnitOfWork<Repos>;
  repos: Repos;
  registry: CurrencyRegistry;
  clock: Clock;
}

/** What an inflow is before anyone asks where it landed. */
export interface InflowFields {
  incomeSourceId: string;
  amount: string;
  /** Undefined = the currency of the source. */
  currency?: string | undefined;
  /** Undefined = today. */
  receivedOn?: string | undefined;
  realisedRateToUsd: string | null;
  note: string | null;
}
export type ResolvedInflow = Omit<NewInflow, 'accountId' | 'creditedAmount'>;

/** The checks create and update share: the source is the caller's, the currency exists, the amount and rate are positive, the date is not in the future. */
export async function resolveInflow(
  deps: Pick<InflowDeps, 'registry' | 'clock'>,
  repos: Pick<Repos, 'incomeSources'>,
  userId: string,
  fields: InflowFields,
): Promise<
  Result<
    { data: ResolvedInflow; currency: Currency },
    NotFoundError | ValidationError | UnknownCurrencyError
  >
> {
  const source = await repos.incomeSources.findById(userId, fields.incomeSourceId);
  if (!source) return err(new NotFoundError('income source'));
  const currency = deps.registry.get(fields.currency ?? source.currency);
  if (currency.isErr()) return err(currency.error);
  if (!new Decimal(fields.amount).gt(0))
    return err(new ValidationError('An inflow is more than zero', 'non_positive_amount'));
  if (fields.realisedRateToUsd !== null && !new Decimal(fields.realisedRateToUsd).gt(0))
    return err(new ValidationError('A rate is more than zero', 'rate_not_positive'));
  const today = deps.clock.today();
  const receivedOn = fields.receivedOn ?? today;
  if (receivedOn > today)
    return err(
      new ValidationError('An inflow cannot be dated in the future', 'received_in_future'),
    );
  return ok({
    currency: currency.value,
    data: {
      incomeSourceId: source.id,
      amount: fields.amount,
      currency: currency.value.code,
      receivedOn,
      realisedRateToUsd: fields.realisedRateToUsd,
      note: fields.note,
    },
  });
}

export const createInflow =
  (deps: InflowDeps) =>
  (userId: string, input: CreateInflowInput): Promise<Result<InflowDto, InflowFailure>> =>
    // Every check runs before the first write: an `err` returned from a unit of work does not roll it back.
    deps.uow(async (repos) => {
      let target: CreditTarget | null = null;
      if (input.accountId) {
        const [account] = await repos.accounts.lock(userId, [input.accountId]);
        if (!account) return err(new NotFoundError('account'));
        const fresh = freshTarget(deps.registry, account);
        if (fresh.isErr()) return err(fresh.error);
        target = fresh.value;
      } else if (input.creditedAmount != null) return err(creditedWithoutAccount());
      const resolved = await resolveInflow(deps, repos, userId, {
        incomeSourceId: input.incomeSourceId,
        amount: input.amount,
        currency: input.currency,
        receivedOn: input.receivedOn,
        realisedRateToUsd: input.realisedRateToUsd ?? null,
        note: input.note ?? null,
      });
      if (resolved.isErr()) return err(resolved.error);
      const { data, currency } = resolved.value;
      let plan: CreditPlan | null = null;
      if (target) {
        const planned = planCredit({
          target,
          amount: Money.of(data.amount, currency),
          creditedAmount: input.creditedAmount ?? undefined,
          receivedOn: data.receivedOn,
          clock: deps.clock,
        });
        if (planned.isErr()) return err(planned.error);
        plan = planned.value;
      }
      const row = await repos.inflows.insert(userId, {
        ...data,
        accountId: plan?.accountId ?? null,
        creditedAmount: plan?.credited.toString() ?? null,
      });
      if (plan) await writeCredit(repos, userId, row.id, plan);
      return ok(toInflowDto(row, plan?.realisedRate?.toFixed() ?? null));
    });
