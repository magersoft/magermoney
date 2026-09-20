import { err, ok, type Result } from 'neverthrow';
import { type CurrencyLookup, UnknownCurrencyError } from '@magermoney/domain';
import type { ManualRateInput, RateDto } from '@magermoney/contracts';
import type { RateRepository } from './rate-repository.js';
export const setManualRate =
  (repo: RateRepository, registry: CurrencyLookup) =>
  async (
    userId: string,
    input: ManualRateInput,
  ): Promise<Result<RateDto, UnknownCurrencyError>> => {
    if (!registry.has(input.base)) return err(new UnknownCurrencyError(input.base));
    await repo.upsertMany([
      { base: input.base, value: input.value, date: input.date, source: 'manual', userId },
    ]);
    return ok({
      base: input.base,
      quote: 'USD',
      value: input.value,
      date: input.date,
      source: 'manual',
    });
  };
