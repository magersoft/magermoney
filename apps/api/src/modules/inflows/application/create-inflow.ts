import { err, ok, type Result } from 'neverthrow';
import {
  Decimal,
  type Clock,
  type Currency,
  type CurrencyRegistry,
  type UnknownCurrencyError,
} from '@magermoney/domain';
import type { CreateInflowInput, InflowDto } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import { toInflowDto } from './dto.js';
import type { NewInflow } from './inflow-repository.js';

export interface InflowDeps {
  uow: UnitOfWork<Repos>;
  repos: Repos;
  registry: CurrencyRegistry;
  clock: Clock;
}
export type InflowFailure = NotFoundError | ValidationError | ConflictError | UnknownCurrencyError;

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
    deps.uow(async (repos) => {
      if (input.accountId)
        return err(
          new ValidationError('Crediting an account is not available yet', 'credit_unavailable'),
        );
      const resolved = await resolveInflow(deps, repos, userId, {
        incomeSourceId: input.incomeSourceId,
        amount: input.amount,
        currency: input.currency,
        receivedOn: input.receivedOn,
        realisedRateToUsd: input.realisedRateToUsd ?? null,
        note: input.note ?? null,
      });
      if (resolved.isErr()) return err(resolved.error);
      const row = await repos.inflows.insert(userId, {
        ...resolved.value.data,
        accountId: null,
        creditedAmount: null,
      });
      return ok(toInflowDto(row));
    });
