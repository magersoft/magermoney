import { describe, expect, it } from 'vitest';
import { ref, type Ref } from 'vue';
import { authGuard } from '../src/modules/auth/application/auth-guard.js';

const mk = (user: null | { id: string }, whenReady = () => Promise.resolve()) =>
  authGuard({ user: ref(user), whenReady });

describe('authGuard', () => {
  it('redirects anonymous users to sign-in with a redirect back', async () => {
    await expect(
      mk(null)({ path: '/settings', fullPath: '/settings', meta: {} } as never, {} as never),
    ).resolves.toEqual({ name: 'sign-in', query: { redirect: '/settings' } });
  });
  it('lets public routes through and signed-in users everywhere', async () => {
    await expect(
      mk(null)(
        { path: '/sign-in', fullPath: '/sign-in', meta: { public: true } } as never,
        {} as never,
      ),
    ).resolves.toBe(true);
    await expect(
      mk({ id: 'u' })({ path: '/', fullPath: '/', meta: {} } as never, {} as never),
    ).resolves.toBe(true);
  });
  it('sends signed-in users away from sign-in', async () => {
    await expect(
      mk({ id: 'u' })(
        {
          path: '/sign-in',
          fullPath: '/sign-in',
          meta: { public: true },
          name: 'sign-in',
        } as never,
        {} as never,
      ),
    ).resolves.toEqual({ path: '/' });
  });

  /*
   * The guard runs before the stored session has been read — that is the whole
   * point of installing it ahead of the router. Deciding on the empty ref it
   * sees at that moment would bounce a signed-in person to sign-in on every
   * cold start.
   */
  it('waits for the stored session instead of deciding on an empty one', async () => {
    const user: Ref<{ id: string } | null> = ref(null);
    const guard = authGuard({
      user,
      whenReady: async () => {
        await Promise.resolve();
        user.value = { id: 'u' };
      },
    });

    await expect(guard({ path: '/', fullPath: '/', meta: {} } as never, {} as never)).resolves.toBe(
      true,
    );
  });
});
