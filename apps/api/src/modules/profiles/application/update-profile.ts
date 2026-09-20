import { err, ok, type Result } from 'neverthrow';
import { type CurrencyLookup, UnknownCurrencyError } from '@magermoney/domain';
import { MAX_REPORTING_CURRENCIES, type UpdateProfileInput } from '@magermoney/contracts';
import type { UserCurrencyRepository } from '../../currencies/application/user-currency-repository.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { Profile, ProfilePatch, ProfileRepository } from './profile-repository.js';

export const updateProfile =
  (repo: ProfileRepository, registry: CurrencyLookup, userCurrencies: UserCurrencyRepository) =>
  async (
    userId: string,
    input: UpdateProfileInput,
  ): Promise<Result<Profile, NotFoundError | UnknownCurrencyError | ValidationError>> => {
    for (const code of [
      ...(input.reportingCurrencies ?? []),
      ...(input.defaultCurrency ? [input.defaultCurrency] : []),
    ]) {
      if (!registry.has(code)) return err(new UnknownCurrencyError(code));
    }
    const current = await repo.findById(userId);
    if (!current) return err(new NotFoundError('profile'));
    const reporting = input.reportingCurrencies ?? current.reportingCurrencies;
    const def = input.defaultCurrency ?? current.defaultCurrency;

    /*
     * The schema caps the list too, but the rule belongs here as well: the
     * error a full switch needs is "you already have three", not "expected at
     * most 3 elements", and only this layer knows which three.
     */
    if (reporting.length > MAX_REPORTING_CURRENCIES)
      return err(
        new ValidationError(
          `The switch holds ${MAX_REPORTING_CURRENCIES} currencies; take one off first`,
          'TOO_MANY_REPORTING_CURRENCIES',
        ),
      );
    if (reporting.length === 0)
      return err(new ValidationError('Keep one currency in the switch', 'NO_REPORTING_CURRENCIES'));

    /*
     * Only a connected currency can sit in the switch. Otherwise the switch
     * offers something no form does, and the person taps it to find every
     * amount unconvertible.
     */
    if (input.reportingCurrencies) {
      const connected = new Set((await userCurrencies.listConnected(userId)).map((c) => c.code));
      const unconnected = input.reportingCurrencies.filter((c) => !connected.has(c));
      if (unconnected.length > 0)
        return err(
          new ValidationError(
            `Add ${unconnected.join(', ')} to your currencies first`,
            'CURRENCY_NOT_CONNECTED',
          ),
        );
    }

    if (!reporting.includes(def))
      return err(new ValidationError(`${def} is not in reporting currencies`));
    const updated = await repo.update(userId, {
      ...input,
      reportingCurrencies: reporting,
      defaultCurrency: def,
    } as ProfilePatch);
    return updated ? ok(updated) : err(new NotFoundError('profile'));
  };
