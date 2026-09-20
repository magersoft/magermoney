import { describe, expect, it } from 'vitest';
import type { CurrencyDto } from '@magermoney/contracts';
import { connectCurrency } from '../src/modules/currencies/application/connect.js';
import { disconnectCurrency } from '../src/modules/currencies/application/disconnect.js';
import { listConnected } from '../src/modules/currencies/application/list-connected.js';
import { MemoryUserCurrencyRepository } from '../src/modules/currencies/infrastructure/memory-user-currency-repository.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import { MemoryProfileRepository } from '../src/modules/profiles/infrastructure/memory-profile-repository.js';
import { memoryUnitOfWork } from '../src/shared/db/unit-of-work.js';
import { memoryRepos } from './helpers/deps.js';

const USER = 'u1';

const catalogue: CurrencyDto[] = [
  {
    code: 'USD',
    kind: 'fiat',
    scale: 2,
    symbol: null,
    nameRu: 'Доллар США',
    nameEn: 'US Dollar',
    icon: null,
    rateSource: 'open-er-api',
  },
  {
    code: 'COP',
    kind: 'fiat',
    scale: 2,
    symbol: null,
    nameRu: 'Колумбийский песо',
    nameEn: 'Colombian Peso',
    icon: null,
    rateSource: 'open-er-api',
  },
  {
    code: 'KPW',
    kind: 'fiat',
    scale: 2,
    symbol: null,
    nameRu: 'Вона',
    nameEn: 'Won',
    icon: null,
    rateSource: null,
  },
];

const repoWith = (connected: string[] = ['USD']) =>
  new MemoryUserCurrencyRepository(catalogue, { [USER]: connected });

/**
 * Disconnecting touches the profile as well as the list, so it takes the unit
 * of work rather than one repository. The profile starts on whatever is
 * connected, as a real one always is.
 */
const uowFor = (repo: MemoryUserCurrencyRepository, reporting?: string[]) => {
  const connected = repo.codesOf(USER);
  const profiles = new MemoryProfileRepository([
    {
      id: USER,
      displayName: null,
      locale: 'ru',
      defaultCurrency: (reporting ?? connected)[0] ?? 'USD',
      reportingCurrencies: reporting ?? connected,
      onboardingCompletedAt: null,
    },
  ]);
  return { uow: memoryUnitOfWork(memoryRepos(profiles, repo)), profiles };
};

describe('connect', () => {
  it('adds a currency from the catalogue to the person’s list', async () => {
    const repo = repoWith();
    expect((await connectCurrency(repo)(USER, 'COP')).isOk()).toBe(true);
    expect((await listConnected(repo)(USER)).map((c) => c.code)).toEqual(['COP', 'USD']);
  });

  it('refuses a code the catalogue does not have', async () => {
    const res = await connectCurrency(repoWith())(USER, 'ZZZ');
    expect(res._unsafeUnwrapErr().code).toBe('UNKNOWN_CURRENCY');
  });

  it('is a no-op the second time rather than an error', async () => {
    const repo = repoWith();
    await connectCurrency(repo)(USER, 'COP');
    expect((await connectCurrency(repo)(USER, 'COP')).isOk()).toBe(true);
    expect((await listConnected(repo)(USER)).map((c) => c.code)).toEqual(['COP', 'USD']);
  });

  it('fetches a rate straight away, so the new currency is not blank until tonight', async () => {
    const repo = repoWith();
    const warmed: string[] = [];
    await connectCurrency(repo, async (code) => {
      warmed.push(code);
    })(USER, 'COP');
    expect(warmed).toEqual(['COP']);
  });

  it('still connects a currency no provider quotes, and does not ask for a rate', async () => {
    const repo = repoWith();
    const warmed: string[] = [];
    const res = await connectCurrency(repo, async (code) => {
      warmed.push(code);
    })(USER, 'KPW');
    expect(res.isOk()).toBe(true);
    expect(warmed).toEqual([]);
  });

  it('connects even when warming the rate fails: the provider is not the point', async () => {
    const repo = repoWith();
    const res = await connectCurrency(repo, async () => {
      throw new Error('provider down');
    })(USER, 'COP');
    expect(res.isOk()).toBe(true);
    expect((await listConnected(repo)(USER)).map((c) => c.code)).toContain('COP');
  });
});

describe('disconnect', () => {
  it('removes a currency nothing uses', async () => {
    const repo = repoWith(['USD', 'COP']);
    expect((await disconnectCurrency(uowFor(repo).uow)(USER, 'COP')).isOk()).toBe(true);
    expect((await listConnected(repo)(USER)).map((c) => c.code)).toEqual(['USD']);
  });

  it('refuses while accounts still hold it, and says where', async () => {
    const repo = repoWith(['USD', 'COP']);
    repo.usageByCode['COP'] = {
      accounts: 2,
      budgets: 0,
      expenses: 0,
      incomeSources: 0,
      inflows: 0,
      profile: false,
    };
    const err = (await disconnectCurrency(uowFor(repo).uow)(USER, 'COP'))._unsafeUnwrapErr();
    expect(err.code).toBe('CURRENCY_IN_USE');
    expect(err.message).toMatch(/account/i);
  });

  it('takes it out of the display switch rather than refusing over a preference', async () => {
    const repo = repoWith(['USD', 'COP']);
    const { uow, profiles } = uowFor(repo, ['USD', 'COP']);

    expect((await disconnectCurrency(uow)(USER, 'COP')).isOk()).toBe(true);
    expect((await profiles.findById(USER))?.reportingCurrencies).toEqual(['USD']);
  });

  it('moves the default currency when the one being removed was it', async () => {
    const repo = repoWith(['USD', 'COP']);
    const { uow, profiles } = uowFor(repo, ['COP', 'USD']);
    expect((await profiles.findById(USER))?.defaultCurrency).toBe('COP');

    expect((await disconnectCurrency(uow)(USER, 'COP')).isOk()).toBe(true);
    const after = await profiles.findById(USER);
    expect(after?.reportingCurrencies).toEqual(['USD']);
    expect(after?.defaultCurrency).toBe('USD');
  });

  it('puts another connected currency in the switch rather than emptying it', async () => {
    const repo = repoWith(['USD', 'COP']);
    const { uow, profiles } = uowFor(repo, ['COP']);

    expect((await disconnectCurrency(uow)(USER, 'COP')).isOk()).toBe(true);
    const after = await profiles.findById(USER);
    expect(after?.reportingCurrencies).toEqual(['USD']);
    expect(after?.defaultCurrency).toBe('USD');
  });

  it('refuses to remove the last one: a list with no currency shows nothing', async () => {
    const repo = repoWith(['USD']);
    expect((await disconnectCurrency(uowFor(repo).uow)(USER, 'USD'))._unsafeUnwrapErr().code).toBe(
      'LAST_CURRENCY',
    );
  });

  it('reports a currency that was never connected as missing', async () => {
    const repo = repoWith(['USD', 'EUR']);
    expect((await disconnectCurrency(uowFor(repo).uow)(USER, 'COP'))._unsafeUnwrapErr().code).toBe(
      'NOT_FOUND',
    );
  });
});

describe('the rates job', () => {
  it('asks only for currencies somebody has connected, not the whole catalogue', async () => {
    const rates = new MemoryRateRepository();
    rates.currencies = catalogue;
    rates.connectedCodes = new Set(['COP']);
    expect((await rates.quotable('open-er-api')).map((c) => c.code)).toEqual(['COP']);
  });
});
