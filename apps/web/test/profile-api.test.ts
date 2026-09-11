import { describe, expect, it, vi } from 'vitest';
import { profileApi } from '../src/modules/profile/infrastructure/profile-api.js';
const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'ru',
  defaultCurrency: 'EUR',
  reportingCurrencies: ['EUR', 'USD'],
  onboardingCompletedAt: null,
};
describe('profileApi', () => {
  it('gets and validates the profile', async () => {
    const client = { fetch: vi.fn(async () => ok(profile)) };
    expect(await profileApi(client).get()).toEqual(profile);
    expect(client.fetch).toHaveBeenCalledWith('/me', expect.anything());
  });
  it('throws a typed ApiError on failure', async () => {
    const client = {
      fetch: vi.fn(async () => ok({ code: 'UNAUTHORIZED', message: 'Sign in required' }, 401)),
    };
    await expect(profileApi(client).get()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
    });
  });
  it('rejects a malformed body', async () => {
    const client = { fetch: vi.fn(async () => ok({ nope: 1 })) };
    await expect(profileApi(client).get()).rejects.toThrow();
  });
});
