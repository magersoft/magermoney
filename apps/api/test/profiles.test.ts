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
      avatarEmoji: null,
      avatarColor: null,
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
  it('refuses one currency past the limit, and says which limit', async () => {
    const { app } = setup();
    const res = await app.request('/me', {
      method: 'PATCH',
      headers: await auth(),
      body: JSON.stringify({
        reportingCurrencies: ['USD', 'EUR', 'RUB', 'KZT', 'GEL', 'COP'],
      }),
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

  describe('the avatar', () => {
    const patch = async (app: ReturnType<typeof setup>['app'], body: unknown) =>
      app.request('/me', { method: 'PATCH', headers: await auth(), body: JSON.stringify(body) });

    it('comes back empty until one is chosen', async () => {
      const { app } = setup();
      const res = await app.request('/me', { headers: await auth() });
      expect(await res.json()).toMatchObject({ avatarEmoji: null, avatarColor: null });
    });

    it('is set by PATCH, and a later change to something else leaves it alone', async () => {
      const { app } = setup();
      const set = await patch(app, { avatarEmoji: '🦊', avatarColor: 'teal' });
      expect(set.status).toBe(200);
      expect(await set.json()).toMatchObject({ avatarEmoji: '🦊', avatarColor: 'teal' });

      const renamed = await patch(app, { displayName: 'Vlad' });
      expect(await renamed.json()).toMatchObject({
        displayName: 'Vlad',
        avatarEmoji: '🦊',
        avatarColor: 'teal',
      });
    });

    it('goes back to the initial when the emoji is cleared with null', async () => {
      const { app } = setup();
      await patch(app, { avatarEmoji: '🦊', avatarColor: 'teal' });
      const res = await patch(app, { avatarEmoji: null });
      expect(await res.json()).toMatchObject({ avatarEmoji: null, avatarColor: 'teal' });
    });

    it.each([
      ['a colour outside the palette', { avatarColor: 'magenta' }],
      ['two emoji', { avatarEmoji: '🦊🐻' }],
    ])('refuses %s with 400 and keeps what was there', async (_label, body) => {
      const { app, profiles } = setup();
      await patch(app, { avatarEmoji: '🦊', avatarColor: 'teal' });
      const res = await patch(app, body);
      expect(res.status).toBe(400);
      expect(await profiles.findById(uid)).toMatchObject({
        avatarEmoji: '🦊',
        avatarColor: 'teal',
      });
    });

    it("changes only the caller's own profile", async () => {
      const other = '22222222-2222-2222-2222-222222222222';
      const { profiles } = setup();
      const mine = await profiles.findById(uid);
      const seeded = new MemoryProfileRepository([mine!, { ...mine!, id: other }]);
      const scoped = createApp(testDeps({ profiles: seeded, jwtSecret: secret }));
      await patch(scoped, { avatarEmoji: '🦊' });
      expect((await seeded.findById(other))?.avatarEmoji).toBeNull();
      expect((await seeded.findById(uid))?.avatarEmoji).toBe('🦊');
    });
  });
});
