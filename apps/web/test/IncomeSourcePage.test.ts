import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import IncomeSourcePage from '../src/modules/income/ui/IncomeSourcePage.vue';
import { inflowDto, sourceDto } from './fixtures/income.js';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast: vi.fn() }) };
});

describe('IncomeSourcePage', () => {
  it("shows the source and asks the API for this source's inflows only", async () => {
    const paths: string[] = [];
    const { wrapper } = await mountAt(
      IncomeSourcePage,
      `/plan/income/${sourceDto.id}`,
      apiOf((p) => {
        paths.push(p);
        if (p === '/income-sources') return json([sourceDto]);
        if (p.startsWith('/inflows')) return json([inflowDto]);
        return undefined;
      }),
    );
    await flushPromises();
    expect(wrapper.get('[data-testid="source-title"]').text()).toBe('Salary');
    expect(wrapper.get('[data-testid="source-net-monthly"]').text()).toContain('765.00');
    expect(wrapper.get(`[data-testid="inflow-row-${inflowDto.id}"]`).text()).toContain('500');
    expect(paths).toContain(`/inflows?limit=200&sourceId=${sourceDto.id}`);
    wrapper.unmount();
  });

  it('ends a source by dating it, never by deleting it', async () => {
    const bodies: unknown[] = [];
    const { wrapper } = await mountAt(
      IncomeSourcePage,
      `/plan/income/${sourceDto.id}`,
      apiOf((p, init) => {
        if (init?.method === 'PATCH') {
          bodies.push(JSON.parse(init.body as string));
          return json({ ...sourceDto, activeTo: '2026-09-17' });
        }
        return p === '/income-sources' ? json([sourceDto]) : undefined;
      }),
    );
    await flushPromises();
    await wrapper.get('[data-testid="source-end"]').trigger('click');
    await flushPromises();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toHaveProperty('activeTo');
    wrapper.unmount();
  });

  it('deletes only after a confirmation and returns to the plan', async () => {
    let deleted = false;
    const { wrapper, router } = await mountAt(
      IncomeSourcePage,
      `/plan/income/${sourceDto.id}`,
      apiOf((p, init) => {
        if (init?.method === 'DELETE') {
          deleted = true;
          return new Response(null, { status: 204 });
        }
        return p === '/income-sources' ? json([sourceDto]) : undefined;
      }),
    );
    await flushPromises();
    await wrapper.get('[data-testid="source-delete"]').trigger('click');
    expect(deleted).toBe(false);
    // The dialog is teleported to the body.
    await new DOMWrapper(document.body)
      .get('[data-testid="source-delete-confirm"]')
      .trigger('click');
    await flushPromises();
    expect(deleted).toBe(true);
    expect(router.currentRoute.value.fullPath).toBe('/plan?tab=income');
    wrapper.unmount();
  });
});
