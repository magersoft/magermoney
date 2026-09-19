import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the plan module: one screen that hosts the income, expenses and budgets segments. */
export const PlanPage = routeComponent(() => import('./ui/PlanPage.vue'));
/** The "+" sheet: the three forms behind one segment. Composed here, where the three modules already meet. */
export { default as OperationSheet } from './ui/OperationSheet.vue';
