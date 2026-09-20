import { err, ok, type Result } from 'neverthrow';
import type { CurrencyUsage } from '@magermoney/contracts';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { UserCurrencyRepository } from './user-currency-repository.js';

/**
 * What the refusal says. The plural names are the screens a person would go to,
 * not table names: "2 accounts" sends them somewhere, "in use" does not.
 */
const PLACES: [keyof CurrencyUsage, string][] = [
  ['accounts', 'accounts'],
  ['budgets', 'budgets'],
  ['expenses', 'expenses'],
  ['incomeSources', 'income sources'],
  ['inflows', 'inflows'],
];

const describe = (usage: CurrencyUsage): string => {
  const parts = PLACES.flatMap(([key, label]) => {
    const n = usage[key] as number;
    return n > 0 ? [`${n} ${label}`] : [];
  });
  if (usage.profile) parts.push('your currency settings');
  return parts.join(', ');
};

/**
 * Disconnects a currency, unless something still refers to it.
 *
 * The guard is here rather than in a foreign key because the answer is a
 * sentence the screen shows, not a constraint violation: the person needs to
 * know it is two accounts and a budget before they can do anything about it.
 */
export const disconnectCurrency =
  (repo: UserCurrencyRepository) =>
  async (userId: string, code: string): Promise<Result<void, ConflictError | NotFoundError>> => {
    const connected = await repo.listConnected(userId);
    if (!connected.some((c) => c.code === code)) return err(new NotFoundError('Currency'));
    if (connected.length === 1)
      return err(
        new ConflictError(
          'LAST_CURRENCY',
          'Keep at least one currency: a list of none shows nothing',
        ),
      );

    const usage = await repo.usage(userId, code);
    const where = describe(usage);
    if (where)
      return err(new ConflictError('CURRENCY_IN_USE', `${code} is still used by ${where}`));

    await repo.disconnect(userId, code);
    return ok(undefined);
  };
