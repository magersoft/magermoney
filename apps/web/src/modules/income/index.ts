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

export { payDaysLabel } from './domain/labels';
export { default as IncomeSegment } from './ui/IncomeSegment.vue';
export { default as InflowRow } from './ui/InflowRow.vue';
/** Routed screens, async: the Plan screen imports this barrel statically for `IncomeSegment`. */
export const IncomeSourcePage = routeComponent(() => import('./ui/IncomeSourcePage.vue'));
export const IncomeSourceFormPage = routeComponent(() => import('./ui/IncomeSourceFormPage.vue'));
