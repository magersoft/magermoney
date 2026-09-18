import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { pageReloader } from '../src/shared/layout/route-fallback.js';
import { installChunkReload, routes } from '../src/app/router.js';

const byName = (name: string) => routes.find((r) => r.name === name);

describe('routes', () => {
  it('puts the dashboard at home and the accounts on their own tab', () => {
    expect(byName('home')?.path).toBe('/');
    expect(byName('accounts')?.path).toBe('/accounts');
  });
  it('keeps the phase 2 screens where links and bookmarks expect them', () => {
    expect(byName('account-new')?.path).toBe('/accounts/new');
    expect(byName('account')?.path).toBe('/accounts/:id');
    expect(byName('account-edit')?.path).toBe('/accounts/:id/edit');
    expect(byName('transfers')?.path).toBe('/transfers');
  });
  it('moves rates under settings and forwards the old address', () => {
    expect(byName('rates')?.path).toBe('/settings/rates');
    expect(routes.find((r) => r.path === '/rates')?.redirect).toBe('/settings/rates');
  });
  it('declares the plan screens', () => {
    expect(byName('plan')?.path).toBe('/plan');
    expect(byName('income-source-new')?.path).toBe('/plan/income/new');
    expect(byName('income-source')?.path).toBe('/plan/income/:id');
    expect(byName('income-source-edit')?.path).toBe('/plan/income/:id/edit');
    expect(byName('expense-new')?.path).toBe('/plan/expenses/new');
    expect(byName('expense-edit')?.path).toBe('/plan/expenses/:id/edit');
    expect(byName('budget-new')?.path).toBe('/plan/budgets/new');
    expect(byName('budget-edit')?.path).toBe('/plan/budgets/:id/edit');
  });
  it('declares static segments before the :id that would swallow them', () => {
    const index = (name: string) => routes.findIndex((r) => r.name === name);
    expect(index('account-new')).toBeLessThan(index('account'));
    expect(index('income-source-new')).toBeLessThan(index('income-source'));
  });
  it('leaves only sign-in and the auth callback public', () => {
    expect(routes.filter((r) => r.meta?.public).map((r) => r.name)).toEqual([
      'sign-in',
      'auth-callback',
    ]);
  });
});

describe('a chunk that never arrives', () => {
  /** A router whose only screen is the file a deploy took away. */
  const gone = () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<i/>' } },
        {
          path: '/plan',
          component: () => Promise.reject(new Error('Failed to fetch dynamically imported module')),
        },
      ],
    });
    installChunkReload(router);
    return router;
  };

  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('spends one full page load on the new index.html, and only one', async () => {
    const assign = vi.spyOn(pageReloader, 'assign').mockImplementation(() => undefined);
    const router = gone();

    await router.push('/plan').catch(() => undefined);
    await router.push('/plan').catch(() => undefined);

    // The second failure is left to surface, so RouteError renders instead of
    // the page reloading forever against an asset that is simply gone.
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/plan');
  });

  it('forgets the attempt once a navigation succeeds, so a later deploy gets its reload', async () => {
    const assign = vi.spyOn(pageReloader, 'assign').mockImplementation(() => undefined);
    const router = gone();

    await router.push('/plan').catch(() => undefined);
    await router.push('/');
    await router.push('/plan').catch(() => undefined);

    expect(assign).toHaveBeenCalledTimes(2);
  });

  it('leaves every other navigation failure alone', async () => {
    const assign = vi.spyOn(pageReloader, 'assign').mockImplementation(() => undefined);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: () => Promise.reject(new Error('boom')) }],
    });
    installChunkReload(router);

    await router.push('/').catch(() => undefined);

    expect(assign).not.toHaveBeenCalled();
  });
});
