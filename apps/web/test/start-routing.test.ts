import { describe, expect, it } from 'vitest';
import { createApp, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Session } from '../src/modules/auth/application/use-session.js';
import { startRouting } from '../src/app/start-routing.js';

const blank = { render: () => h('i') };
/** The composition root stands in for App.vue: nothing here renders, only routes. */
const root = { render: () => h('div') };

/** The address the person arrived on, set on the history the router will read at install. */
const testRouter = (at = '/') => {
  const history = createMemoryHistory();
  history.replace(at);
  return createRouter({
    history,
    routes: [
      { path: '/', name: 'home', component: blank },
      { path: '/settings', name: 'settings', component: blank },
      { path: '/sign-in', name: 'sign-in', component: blank, meta: { public: true } },
    ],
  });
};

/**
 * A session that is only known later, which is the real one: reading the stored
 * session is a round trip, and the first navigation starts before it answers.
 */
const lateSession = (id: string | null): Session => {
  const user = ref<{ id: string; email: string | null } | null>(null);
  return {
    user,
    ready: ref(false),
    whenReady: async () => {
      await Promise.resolve();
      user.value = id ? { id, email: null } : null;
    },
  } as unknown as Session;
};

describe('the first navigation', () => {
  it('sends someone with no session to sign-in instead of rendering home', async () => {
    const router = testRouter();
    const app = createApp(root);

    await startRouting(app, router, lateSession(null));

    expect(router.currentRoute.value.name).toBe('sign-in');
    expect(router.currentRoute.value.query.redirect).toBe('/');
  });

  it('carries the destination, so the way back is the screen that was asked for', async () => {
    const router = testRouter('/settings');
    const app = createApp(root);

    await startRouting(app, router, lateSession(null));

    expect(router.currentRoute.value.query.redirect).toBe('/settings');
  });

  it('leaves a signed-in person on the screen they opened', async () => {
    const router = testRouter();
    const app = createApp(root);

    await startRouting(app, router, lateSession('u'));

    expect(router.currentRoute.value.name).toBe('home');
  });

  it('lets a public screen through without waiting on anyone', async () => {
    const router = testRouter('/sign-in');
    const app = createApp(root);

    await startRouting(app, router, lateSession(null));

    expect(router.currentRoute.value.name).toBe('sign-in');
  });
});
