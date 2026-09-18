import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the income module: Income sources, their pay schedule, and the Inflows that actually arrived. */

export { toIncomeSource, toInflow } from './domain/mappers';
export {
  useIncomeSources,
  useIncomeSource,
  INCOME_SOURCES_KEY,
} from './application/use-income-sources';
export {
  useCreateIncomeSource,
  useUpdateIncomeSource,
  useDeleteIncomeSource,
} from './application/use-income-source-mutations';
export { useInflows, INFLOWS_KEY, inflowsKey, type InflowParams } from './application/use-inflows';
export { useUpdateInflow, useDeleteInflow } from './application/use-inflow-mutations';

/** Still the Task 19 stand-ins; Task 21 points these at the real screens. */
export const IncomeSourcePage = routeComponent(() => import('@/shared/layout/PendingPage.vue'));
export const IncomeSourceFormPage = routeComponent(() => import('@/shared/layout/PendingPage.vue'));
