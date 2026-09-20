import { describe, expect, it } from 'vitest';
import type { CurrencyDto } from '@magermoney/contracts';
import { createApp } from '../src/app.js';
import { MemoryUserCurrencyRepository } from '../src/modules/currencies/infrastructure/memory-user-currency-repository.js';
import { testDeps } from './helpers/deps.js';
import { signTestToken } from './helpers/token.js';

const uid = '11111111-1111-1111-1111-111111111111';
const secret = 'test-secret-test-secret-test-secret-1234';
const auth = async () => ({
  authorization: `Bearer ${await signTestToken(uid, secret)}`,
  'content-type': 'application/json',
});

const fiat = (code: string, nameEn: string): CurrencyDto => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn,
  icon: null,
  rateSource: 'open-er-api',
});

const catalogue = [fiat('USD', 'US Dollar'), fiat('EUR', 'Euro'), fiat('COP', 'Colombian Peso')];

function setup(connected = ['USD', 'EUR']) {
  const userCurrencies = new MemoryUserCurrencyRepository(catalogue, { [uid]: connected });
  return { app: createApp(testDeps({ userCurrencies, jwtSecret: secret })), userCurrencies };
}

describe('/me/currencies', () => {
  it('requires a signed-in user', async () => {
    expect((await setup().app.request('/me/currencies')).status).toBe(401);
  });

  it('lists what the caller has connected, not the whole catalogue', async () => {
    const res = await setup().app.request('/me/currencies', { headers: await auth() });
    expect(res.status).toBe(200);
    expect(((await res.json()) as CurrencyDto[]).map((c) => c.code)).toEqual(['EUR', 'USD']);
  });

  it('connects a currency and answers with the new list', async () => {
    const res = await setup().app.request('/me/currencies', {
      method: 'POST',
      headers: await auth(),
      body: JSON.stringify({ code: 'COP' }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as CurrencyDto[]).map((c) => c.code)).toEqual(['COP', 'EUR', 'USD']);
  });

  it('rejects a code that is not in the catalogue', async () => {
    const res = await setup().app.request('/me/currencies', {
      method: 'POST',
      headers: await auth(),
      body: JSON.stringify({ code: 'ZZZ' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('UNKNOWN_CURRENCY');
  });

  it('disconnects a currency nothing uses', async () => {
    const { app, userCurrencies } = setup();
    const res = await app.request('/me/currencies/EUR', {
      method: 'DELETE',
      headers: await auth(),
    });
    expect(res.status).toBe(204);
    expect((await userCurrencies.listConnected(uid)).map((c) => c.code)).toEqual(['USD']);
  });

  it('refuses with 409 and an explanation while something still uses it', async () => {
    const { app, userCurrencies } = setup();
    userCurrencies.usageByCode['EUR'] = {
      accounts: 1,
      budgets: 0,
      expenses: 3,
      incomeSources: 0,
      inflows: 0,
      profile: false,
    };
    const res = await app.request('/me/currencies/EUR', {
      method: 'DELETE',
      headers: await auth(),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CURRENCY_IN_USE');
    expect(body.message).toContain('1 accounts');
    expect(body.message).toContain('3 expenses');
  });

  it('404s on a currency that was never connected', async () => {
    const res = await setup().app.request('/me/currencies/COP', {
      method: 'DELETE',
      headers: await auth(),
    });
    expect(res.status).toBe(404);
  });
});
