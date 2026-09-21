import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the goals module: what the money is still on its way to. */
export { toGoal } from './domain/mappers';
export { GOALS_KEY, useGoals } from './application/use-goals';
export { progressOf, useGoalProgress } from './application/use-goal-progress';
export { monthlySeries, useGoalForecast } from './application/use-goal-forecast';
export {
  useArchiveGoal,
  useCreateGoal,
  useDeleteGoal,
  useUpdateGoal,
} from './application/use-goal-mutations';
export { default as GoalsSegment } from './ui/GoalsSegment.vue';
export { default as GoalCard } from './ui/GoalCard.vue';
/** Routed screens, async: the Savings screen imports this barrel statically. */
export const GoalPage = routeComponent(() => import('./ui/GoalPage.vue'));
export const GoalFormPage = routeComponent(() => import('./ui/GoalFormPage.vue'));
