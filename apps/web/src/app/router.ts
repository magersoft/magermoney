import { createRouter, createWebHistory, type Router, type RouteRecordRaw } from 'vue-router';
import { isChunkLoadError, pageReloader } from '@/shared/layout/route-fallback';

/**
 * Pages are reached through each module's public API, so a route never points
 * inside a module. Everything is private unless `meta.public` says otherwise —
 * the guard defaults to closed, so a new screen cannot leak by omission.
 *
 * A static segment (`/accounts/new`) is declared before the `:id` that would
 * otherwise match it.
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/modules/dashboard').then((m) => m.DashboardPage),
  },
  {
    path: '/accounts',
    name: 'accounts',
    component: () => import('@/modules/accounts').then((m) => m.AccountsPage),
  },
  {
    path: '/accounts/new',
    name: 'account-new',
    component: () => import('@/modules/accounts').then((m) => m.AccountFormPage),
  },
  {
    path: '/accounts/:id',
    name: 'account',
    component: () => import('@/modules/accounts').then((m) => m.AccountDetailPage),
  },
  {
    path: '/accounts/:id/edit',
    name: 'account-edit',
    component: () => import('@/modules/accounts').then((m) => m.AccountFormPage),
  },
  {
    path: '/transfers',
    name: 'transfers',
    component: () => import('@/modules/transfers').then((m) => m.TransfersPage),
  },
  {
    path: '/plan',
    name: 'plan',
    component: () => import('@/modules/plan').then((m) => m.PlanPage),
  },
  {
    path: '/plan/income/new',
    name: 'income-source-new',
    component: () => import('@/modules/income').then((m) => m.IncomeSourceFormPage),
  },
  {
    path: '/plan/income/:id',
    name: 'income-source',
    component: () => import('@/modules/income').then((m) => m.IncomeSourcePage),
  },
  {
    path: '/plan/income/:id/edit',
    name: 'income-source-edit',
    component: () => import('@/modules/income').then((m) => m.IncomeSourceFormPage),
  },
  {
    path: '/plan/expenses/new',
    name: 'expense-new',
    component: () => import('@/modules/expenses').then((m) => m.ExpenseFormPage),
  },
  {
    path: '/plan/expenses/:id/edit',
    name: 'expense-edit',
    component: () => import('@/modules/expenses').then((m) => m.ExpenseFormPage),
  },
  {
    path: '/plan/budgets/new',
    name: 'budget-new',
    component: () => import('@/modules/budgets').then((m) => m.BudgetFormPage),
  },
  {
    path: '/plan/budgets/:id/edit',
    name: 'budget-edit',
    component: () => import('@/modules/budgets').then((m) => m.BudgetFormPage),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/modules/profile').then((m) => m.SettingsPage),
  },
  {
    path: '/settings/rates',
    name: 'rates',
    component: () => import('@/modules/rates').then((m) => m.RatesPage),
  },
  // Rates had a tab of its own in phase 2; bookmarks and the installed PWA's history still point here.
  { path: '/rates', redirect: '/settings/rates' },
  {
    path: '/sign-in',
    name: 'sign-in',
    component: () => import('@/modules/auth').then((m) => m.SignInPage),
    meta: { public: true },
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('@/modules/auth').then((m) => m.AuthCallbackPage),
    meta: { public: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

/** The path a full page load was already spent on, kept across that load. */
const RELOAD_MARKER = 'mm:chunk-reload';

/**
 * Records that this path is about to cost a full page load, and answers whether
 * it is the first one. A stale precache or an asset that is simply gone would
 * otherwise fail again after the reload and reload again, forever, showing
 * nothing — so the marker has to outlive the reload, which is what
 * `sessionStorage` is for. If it refuses to store anything there is no way to
 * bound the loop at all, and the error screen beats an endless white one.
 */
function claimReload(path: string): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_MARKER) === path) return false;
    sessionStorage.setItem(RELOAD_MARKER, path);
    return true;
  } catch {
    return false;
  }
}

function releaseReload(): void {
  try {
    sessionStorage.removeItem(RELOAD_MARKER);
  } catch {
    /* Nothing was stored, so nothing has to be cleared. */
  }
}

/**
 * A module barrel that fails to load takes the navigation down with it, before
 * any screen exists to show a fallback. After a deploy that means the file is
 * gone, and the only cure is the new `index.html`: go to the target with a full
 * page load instead of leaving the person on a dead link — but once only. The
 * second failure is allowed to surface, so `RouteError` renders and the person
 * gets a sentence and a button instead of a reload loop.
 *
 * Exported so a test can install it on a router of its own: there is no public
 * way to make the app's router fail on demand.
 */
export function installChunkReload(target: Router): void {
  target.onError((error, to) => {
    if (isChunkLoadError(error) && claimReload(to.fullPath)) pageReloader.assign(to.fullPath);
  });
  // Arriving anywhere means the chunks are being served again.
  target.afterEach(releaseReload);
}

installChunkReload(router);
