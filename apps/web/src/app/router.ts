import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { isChunkLoadError } from '@/shared/layout/route-fallback';

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

/**
 * A module barrel that fails to load takes the navigation down with it, before
 * any screen exists to show a fallback. After a deploy that means the file is
 * gone, and the only cure is the new `index.html`: go to the target with a full
 * page load instead of leaving the person on a dead link.
 */
router.onError((error, to) => {
  if (isChunkLoadError(error)) window.location.assign(to.fullPath);
});
