import { routeComponent } from '@/shared/layout/route-fallback';

/**
 * Public API of the savings module. It owns no data: the screen composes the
 * goals and assets modules through their barrels, exactly as the Plan screen
 * composes income, expenses and budgets.
 */
export const SavingsPage = routeComponent(() => import('./ui/SavingsPage.vue'));
