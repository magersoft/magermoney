import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { onlineManager } from '@tanstack/vue-query';

const signOut = vi.fn(async () => ({ error: null }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signOut, onAuthStateChange: vi.fn(), getSession: vi.fn() } }),
}));

// Importing the cache owners is what registers their cleanups, so this is also
// the assertion that the wiring exists.
const { persister, queryClient } = await import('../src/app/query.js');
const { useSession } = await import('../src/modules/auth/application/use-session.js');
const { resetDisplayCurrency } =
  await import('../src/modules/rates/application/use-display-currency.js');

describe('signing out on a shared device', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    // Mounted first, always: only a mounted client resumes what it restored,
    // and `afterEach` unmounts whatever `beforeEach` mounted.
    queryClient.mount();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
    queryClient.unmount();
  });

  it('drops the query cache, its stored copy, the API cache and the display currency', async () => {
    queryClient.setQueryData(['rates', 'previous-account'], { EUR: '1.16' });
    localStorage.setItem('displayCurrency', 'RUB');

    const removeClient = vi.spyOn(persister, 'removeClient').mockResolvedValue(undefined);
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', { delete: del });

    await useSession().signOut();

    expect(signOut).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(['rates', 'previous-account'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(removeClient).toHaveBeenCalledOnce();
    expect(del).toHaveBeenCalledWith('api');
    expect(localStorage.getItem('displayCurrency')).toBeNull();

    vi.unstubAllGlobals();
    removeClient.mockRestore();
  });

  it('drops the writes that were still waiting for a connection', async () => {
    // They belong to the account that is leaving: replayed under the next
    // person's token they would write into someone else's journal.
    onlineManager.setOnline(false);
    void queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: async () => {
          throw new TypeError('Failed to fetch');
        },
      })
      .execute(undefined)
      .catch(() => undefined);
    for (let i = 0; i < 400 && !queryClient.getMutationCache().getAll()[0]?.state.isPaused; i++)
      await new Promise((r) => setTimeout(r, 10));
    expect(queryClient.getMutationCache().getAll()[0]?.state.isPaused).toBe(true);

    vi.spyOn(persister, 'removeClient').mockResolvedValue(undefined);
    await useSession().signOut();

    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  });

  it('forgets the display currency singleton so the next account re-picks it', () => {
    localStorage.setItem('displayCurrency', 'RUB');
    resetDisplayCurrency();
    expect(localStorage.getItem('displayCurrency')).toBeNull();
  });
});
