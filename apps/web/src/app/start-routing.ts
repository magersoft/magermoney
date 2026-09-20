import type { App } from 'vue';
import type { Router } from 'vue-router';
import { authGuard, type Session } from '@/modules/auth';

/**
 * Puts the guard on the router and then installs it, in that order and nowhere
 * else, because the order is the whole point.
 *
 * Installing the router is what starts the first navigation, and vue-router
 * collects its `beforeEach` guards inside it — one microtask later. A guard
 * registered after `app.use(router)` therefore never sees the navigation the
 * person actually arrived on: home renders to someone with no session, every
 * query on it goes out without a token, and the screen shows a load error
 * instead of the way in.
 *
 * Resolves once the destination is settled, so nothing is mounted over a route
 * that is about to be replaced by sign-in.
 */
export function startRouting(app: App, router: Router, session: Session): Promise<void> {
  router.beforeEach(authGuard(session));
  app.use(router);
  return router.isReady();
}
