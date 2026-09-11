import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

/**
 * Pages are reached through each module's public API, so a route never points
 * inside a module. Everything is private unless `meta.public` says otherwise —
 * the guard defaults to closed, so a new screen cannot leak by omission.
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
