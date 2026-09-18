import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the dashboard module: a read model over the other modules, with no data of its own. */
export const DashboardPage = routeComponent(() => import('./ui/DashboardPage.vue'));
