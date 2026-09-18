import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the expenses module: fixed obligations and their categories. */
export { toExpense } from './domain/mappers';
export { EXPENSES_KEY, useExpenses } from './application/use-expenses';
export { useExpenseCategories } from './application/use-expense-categories';
export {
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from './application/use-expense-mutations';
export { groupExpenses, type ExpenseGroups } from './application/expense-groups';
export { default as ExpensesSegment } from './ui/ExpensesSegment.vue';
/** Routed screen, async: the Plan screen and the dashboard import this barrel statically. */
export const ExpenseFormPage = routeComponent(() => import('./ui/ExpenseFormPage.vue'));
