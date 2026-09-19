import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the dashboard module. It owns no data: a read model over the other modules. */
export { useDashboard } from './application/use-dashboard';
export {
  buildDashboard,
  type DashboardModel,
  type DashboardInput,
} from './application/build-dashboard';
export const DashboardPage = routeComponent(() => import('./ui/DashboardPage.vue'));
