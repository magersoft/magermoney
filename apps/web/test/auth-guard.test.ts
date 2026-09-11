import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { authGuard } from '../src/modules/auth/application/auth-guard.js';
const mk = (user: null | { id: string }) => authGuard({ user: ref(user), ready: ref(true) });
describe('authGuard', () => {
  it('redirects anonymous users to sign-in with a redirect back', () => {
    expect(
      mk(null)({ path: '/settings', fullPath: '/settings', meta: {} } as never, {} as never),
    ).toEqual({ name: 'sign-in', query: { redirect: '/settings' } });
  });
  it('lets public routes through and signed-in users everywhere', () => {
    expect(
      mk(null)(
        { path: '/sign-in', fullPath: '/sign-in', meta: { public: true } } as never,
        {} as never,
      ),
    ).toBe(true);
    expect(mk({ id: 'u' })({ path: '/', fullPath: '/', meta: {} } as never, {} as never)).toBe(
      true,
    );
  });
  it('sends signed-in users away from sign-in', () => {
    expect(
      mk({ id: 'u' })(
        {
          path: '/sign-in',
          fullPath: '/sign-in',
          meta: { public: true },
          name: 'sign-in',
        } as never,
        {} as never,
      ),
    ).toEqual({ path: '/' });
  });
});
