import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the budgets module: variable categories with a monthly limit. */
export { toBudget } from './domain/mappers';
export { BUDGETS_KEY, useBudgets } from './application/use-budgets';
export {
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
} from './application/use-budget-mutations';
export { summariseBudgets, type BudgetSummary } from './application/budget-summary';
export { default as BudgetsSegment } from './ui/BudgetsSegment.vue';
/** Routed screen, async: the Plan screen imports this barrel statically. */
export const BudgetFormPage = routeComponent(() => import('./ui/BudgetFormPage.vue'));
