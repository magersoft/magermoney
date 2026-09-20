import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError } from '@magermoney/domain';
import { logger } from '../../../shared/logger.js';
import type { UserCurrencyRepository } from './user-currency-repository.js';

/** Fetches one currency's rate now. Throws whatever the provider throws. */
export type WarmRate = (code: string) => Promise<void>;

/**
 * Connects a currency, then asks for its rate immediately.
 *
 * Without the second step the currency is present but blank until the nightly
 * job runs, and every amount in it shows as unconvertible on the screen the
 * person is still looking at. The warm-up is deliberately best-effort: a
 * provider being down is not a reason to refuse the connection, which is a
 * decision about this person's list, not about the provider.
 */
export const connectCurrency =
  (repo: UserCurrencyRepository, warm?: WarmRate) =>
  async (userId: string, code: string): Promise<Result<void, UnknownCurrencyError>> => {
    const connected = await repo.listConnected(userId);
    if (connected.some((c) => c.code === code)) return ok(undefined);

    const known = await repo.catalogueEntry(code);
    if (!known) return err(new UnknownCurrencyError(code));

    await repo.connect(userId, code);

    if (warm && known.rateSource !== null) {
      try {
        await warm(code);
      } catch (e) {
        logger.warn({ err: e, code }, 'could not warm the rate for a newly connected currency');
      }
    }
    return ok(undefined);
  };
