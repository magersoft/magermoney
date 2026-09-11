import { err, ok, type Result } from 'neverthrow';
import { type CurrencyRegistry, UnknownCurrencyError } from '@magermoney/domain';
import type { UpdateProfileInput } from '@magermoney/contracts';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { Profile, ProfilePatch, ProfileRepository } from './profile-repository.js';

export const updateProfile = (repo: ProfileRepository, registry: CurrencyRegistry) =>
  async (userId: string, input: UpdateProfileInput): Promise<Result<Profile, NotFoundError | UnknownCurrencyError | ValidationError>> => {
    for (const code of [...(input.reportingCurrencies ?? []), ...(input.defaultCurrency ? [input.defaultCurrency] : [])]) {
      if (!registry.has(code)) return err(new UnknownCurrencyError(code));
    }
    const current = await repo.findById(userId);
    if (!current) return err(new NotFoundError('profile'));
    const reporting = input.reportingCurrencies ?? current.reportingCurrencies;
    const def = input.defaultCurrency ?? current.defaultCurrency;
    if (!reporting.includes(def)) return err(new ValidationError(`${def} is not in reporting currencies`));
    const updated = await repo.update(userId, { ...input, reportingCurrencies: reporting, defaultCurrency: def } as ProfilePatch);
    return updated ? ok(updated) : err(new NotFoundError('profile'));
  };
