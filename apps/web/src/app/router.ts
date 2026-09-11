import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

/**
 * Pages are reached through each module's public API, so a route never points
 * inside a module. The auth guard is added in Task 14.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/modules/rates').then((m) => m.HomePage),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/modules/profile').then((m) => m.SettingsPage),
  },
  {
    path: '/sign-in',
    name: 'sign-in',
    component: () => import('@/modules/auth').then((m) => m.SignInPage),
    meta: { public: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
