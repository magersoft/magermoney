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
) => NavigationGuardReturn;

/**
 * The single place that decides who may see a route. Everything is private
 * unless the route says `meta.public`, so a new screen cannot leak by omission.
 */
export const authGuard =
  (s: { user: Ref<{ id: string } | null>; ready: Ref<boolean> }): AuthGuard =>
  (to: RouteLocationNormalized) => {
    const isPublic = Boolean(to.meta.public);
    if (s.user.value && to.name === 'sign-in') return { path: '/' };
    if (!s.user.value && !isPublic) return { name: 'sign-in', query: { redirect: to.fullPath } };
    return true;
  };
