import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { ProfileDto } from '@magermoney/contracts';
import { API_KEY } from '../src/shared/api/use-api.js';
import { useProfile } from '../src/modules/profile/application/use-profile.js';

const profile: ProfileDto = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'ru',
  defaultCurrency: 'EUR',
  reportingCurrencies: ['EUR', 'USD'],
  onboardingCompletedAt: null,
  avatarEmoji: null,
  avatarColor: null,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A PATCH that never settles until the test lets it, so the optimistic value can be observed. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mountProfile(fetchImpl: (path: string, init?: RequestInit) => Promise<Response>) {
  let api!: ReturnType<typeof useProfile>;
  const Probe = defineComponent({
    setup() {
      api = useProfile();
      return () => h('div');
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = mount(Probe, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      provide: { [API_KEY as unknown as string]: { fetch: fetchImpl } },
    },
  });
  return { wrapper, api: () => api };
}

describe('useProfile', () => {
  it('reads the profile through the API', async () => {
    const { api } = mountProfile(async () => json(profile));
    await flushPromises();

    expect(api().profile.value).toEqual(profile);
  });

  it('shows the new value before the PATCH answers and rolls back when it fails', async () => {
    const patch = deferred<Response>();
    const fetchImpl = vi.fn(async (_path: string, init?: RequestInit) =>
      init?.method === 'PATCH' ? patch.promise : json(profile),
    );
    const { api } = mountProfile(fetchImpl);
    await flushPromises();

    const updated = api().update({ defaultCurrency: 'USD' });
    await nextTick();
    await flushPromises();

    expect(api().profile.value?.defaultCurrency).toBe('USD');

    patch.reject(new Error('offline'));
    await updated.catch(() => undefined);
    await flushPromises();

    expect(api().profile.value?.defaultCurrency).toBe('EUR');
  });

  /*
   * Leafing through the avatar grid with the arrow keys saves on every step.
   * Two PATCHes in flight at once can land in either order, and the server
   * would keep whichever came last rather than the one picked last.
   */
  it('sends one write at a time, in the order they were made', async () => {
    const first = deferred<Response>();
    const bodies: string[] = [];
    const fetchImpl = vi.fn(async (_path: string, init?: RequestInit) => {
      if (init?.method !== 'PATCH') return json(profile);
      bodies.push(String(init.body));
      return bodies.length === 1 ? first.promise : json({ ...profile, avatarEmoji: '🐻' });
    });
    const { api } = mountProfile(fetchImpl);
    await flushPromises();

    const a = api().update({ avatarEmoji: '🦊' });
    const b = api().update({ avatarEmoji: '🐻' });
    await flushPromises();
    expect(bodies).toHaveLength(1);

    first.resolve(json({ ...profile, avatarEmoji: '🦊' }));
    await Promise.all([a, b]);
    expect(bodies.map((body) => JSON.parse(body).avatarEmoji)).toEqual(['🦊', '🐻']);
  });
});
