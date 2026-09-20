import { err, ok, type Result } from 'neverthrow';
import type { CurrencyUsage } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';

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
  return parts.join(', ');
};

/**
 * Disconnects a currency, unless a record still refers to it.
 *
 * The guard is a use case rather than a foreign key because the answer is a
 * sentence the screen shows: the person needs to know it is two accounts and a
 * budget before they can do anything about it.
 *
 * The display switch is deliberately not part of that guard. An account is
 * evidence that the currency holds money; a place in the switch is only a
 * preference, so disconnecting quietly takes it out of the switch — and moves
 * the default currency if it was the one — rather than making the person go and
 * undo a setting first. That is two tables, so it is one transaction.
 */
export const disconnectCurrency =
  (uow: UnitOfWork<Repos>) =>
  async (userId: string, code: string): Promise<Result<void, ConflictError | NotFoundError>> =>
    uow(async (repos) => {
      const connected = await repos.userCurrencies.listConnected(userId);
      if (!connected.some((c) => c.code === code)) return err(new NotFoundError('Currency'));
      if (connected.length === 1)
        return err(
          new ConflictError(
            'LAST_CURRENCY',
            'Keep at least one currency: a list of none shows nothing',
          ),
        );

      const usage = await repos.userCurrencies.usage(userId, code);
      const where = describe(usage);
      if (where)
        return err(new ConflictError('CURRENCY_IN_USE', `${code} is still used by ${where}`));

      const profile = await repos.profiles.findById(userId);
      if (profile && profile.reportingCurrencies.includes(code)) {
        const reporting = profile.reportingCurrencies.filter((c) => c !== code);
        /*
         * The switch must never be empty, and its currencies must be connected
         * — so when the last one goes, the first currency still on the list
         * takes its place rather than the switch disappearing.
         */
        const fallback = connected.find((c) => c.code !== code)?.code;
        const next = reporting.length > 0 ? reporting : fallback ? [fallback] : reporting;
        if (next.length === 0)
          return err(
            new ConflictError('LAST_CURRENCY', 'Keep at least one currency in the switch'),
          );
        await repos.profiles.update(userId, {
          reportingCurrencies: next,
          defaultCurrency: next.includes(profile.defaultCurrency)
            ? profile.defaultCurrency
            : (next[0] as string),
        });
      }

      await repos.userCurrencies.disconnect(userId, code);
      return ok(undefined);
    });
