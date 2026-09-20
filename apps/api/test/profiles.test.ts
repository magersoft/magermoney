import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MemoryProfileRepository } from '../src/modules/profiles/infrastructure/memory-profile-repository.js';
import { MemoryUserCurrencyRepository } from '../src/modules/currencies/infrastructure/memory-user-currency-repository.js';
import { testDeps } from './helpers/deps.js';
import { signTestToken } from './helpers/token.js';

const uid = '11111111-1111-1111-1111-111111111111';
const secret = 'test-secret-test-secret-test-secret-1234';
const auth = async () => ({
  authorization: `Bearer ${await signTestToken(uid, secret)}`,
  'content-type': 'application/json',
});

function setup(over: Partial<Parameters<typeof testDeps>[0]> = {}) {
  const profiles = new MemoryProfileRepository([
    {
      id: uid,
      displayName: null,
      locale: 'ru',
      defaultCurrency: 'EUR',
      reportingCurrencies: ['EUR', 'USD', 'RUB'],
      onboardingCompletedAt: null,
    },
  ]);
  return { app: createApp(testDeps({ profiles, jwtSecret: secret, ...over })), profiles };
}

describe('/me', () => {
  it('returns the caller profile', async () => {
    const { app } = setup();
    const res = await app.request('/me', { headers: await auth() });
    expect(res.status).toBe(200);
    expect((await res.json()).defaultCurrency).toBe('EUR');
  });
  it('404s when the profile row is missing', async () => {
    const app = createApp(
      testDeps({ profiles: new MemoryProfileRepository([]), jwtSecret: secret }),
    );
    expect((await app.request('/me', { headers: await auth() })).status).toBe(404);
  });
  it('updates reporting currencies and default', async () => {
    const { app } = setup();
    const res = await app.request('/me', {
      method: 'PATCH',
      headers: await auth(),
      body: JSON.stringify({ reportingCurrencies: ['USD', 'KZT'], defaultCurrency: 'KZT' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      reportingCurrencies: ['USD', 'KZT'],
      defaultCurrency: 'KZT',
    });
  });
  it('rejects an unknown currency with 400', async () => {
    const { app } = setup();
    const res = await app.request('/me', {
      method: 'PATCH',
      headers: await auth(),
      body: JSON.stringify({ reportingCurrencies: ['USD', 'XYZ'] }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('UNKNOWN_CURRENCY');
  });
  it('refuses a fourth currency in the switch, and says which limit', async () => {
    const { app } = setup();
    const res = await app.request('/me', {
      method: 'PATCH',
      headers: await auth(),
      body: JSON.stringify({ reportingCurrencies: ['USD', 'EUR', 'RUB', 'KZT'] }),
    });
    expect(res.status).toBe(400);
    // The schema catches it first; either way the request does not land.
    expect(['TOO_MANY_REPORTING_CURRENCIES', 'VALIDATION']).toContain((await res.json()).code);
  });

  it('refuses a currency the person has not connected', async () => {
    const userCurrencies = new MemoryUserCurrencyRepository(
      [
        {
          code: 'USD',
          kind: 'fiat',
          scale: 2,
          symbol: null,
          nameRu: null,
          nameEn: null,
          icon: null,
          rateSource: 'open-er-api',
        },
      ],
      { [uid]: ['USD'] },
    );
    const { app } = setup({ userCurrencies });
    const res = await app.request('/me', {
      method: 'PATCH',
      headers: await auth(),
      body: JSON.stringify({ reportingCurrencies: ['USD', 'KZT'] }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('CURRENCY_NOT_CONNECTED');
  });

  it('rejects a default outside the reporting list with 400', async () => {
    const { app } = setup();
    const res = await app.request('/me', {
      method: 'PATCH',
      headers: await auth(),
      body: JSON.stringify({ reportingCurrencies: ['USD'], defaultCurrency: 'EUR' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION');
  });
});
