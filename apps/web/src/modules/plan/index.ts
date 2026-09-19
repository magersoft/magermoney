import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the plan module: one screen that hosts the income, expenses and budgets segments. */
export const PlanPage = routeComponent(() => import('./ui/PlanPage.vue'));
