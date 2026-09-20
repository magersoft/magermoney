import type { Ref } from 'vue';
import type { NavigationGuardReturn, RouteLocationNormalized } from 'vue-router';

/**
 * A guard that takes `to` and `from` and nothing else: no `next`, so it cannot
 * forget to call it, and no router, so it can be tested as the pure decision it
 * is. `router.beforeEach` accepts it — a guard may declare fewer parameters.
 */
export type AuthGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
) => Promise<NavigationGuardReturn>;

/**
 * The single place that decides who may see a route. Everything is private
 * unless the route says `meta.public`, so a new screen cannot leak by omission.
 *
 * It waits for the stored session first. The guard is installed before the
 * router is — installing the router starts the first navigation, so a guard
 * added afterwards never sees it — and at that moment nobody has read the
 * stored session yet. Deciding on the empty ref would send a signed-in person
 * to sign-in on every cold start, so the navigation waits for the answer
 * instead of guessing at it.
 */
export const authGuard =
  (s: { user: Ref<{ id: string } | null>; whenReady: () => Promise<void> }): AuthGuard =>
  async (to: RouteLocationNormalized) => {
    await s.whenReady();
    const isPublic = Boolean(to.meta.public);
    if (s.user.value && to.name === 'sign-in') return { path: '/' };
    if (!s.user.value && !isPublic) return { name: 'sign-in', query: { redirect: to.fullPath } };
    return true;
  };
