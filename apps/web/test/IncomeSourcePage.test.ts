import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import IncomeSourcePage from '../src/modules/income/ui/IncomeSourcePage.vue';
import { inflowDto, sourceDto } from './fixtures/income.js';
import { apiOf, json, mountAt, type Fetch } from './fixtures/income-mount.js';

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

  /*
   * Writing down money that arrived is what this screen is opened for, so it
   * sits in the bar rather than at the head of a row of four buttons. Only the
   * shell has a bar, so only a mount inside it has the action.
   */
  it('records an inflow from the top bar, and leaves the rarer actions on the page', async () => {
    const { wrapper } = await mountAt(
      IncomeSourcePage,
      `/plan/income/${sourceDto.id}`,
      apiOf((p) => {
        if (p === '/income-sources') return json([sourceDto]);
        if (p.startsWith('/inflows')) return json([]);
        return undefined;
      }),
      {},
      true,
    );
    await flushPromises();

    const record = wrapper.get('[data-testid="source-record-inflow"]');
    expect(record.text()).toBe('Записать');
    expect(record.attributes('aria-label')).toBe('Записать поступление');

    await record.trigger('click');
    await flushPromises();
    expect(document.querySelector('[data-testid="inflow-amount"]')).not.toBeNull();

    /* The three that stayed are still where they were. */
    expect(wrapper.find('[data-testid="source-edit"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-delete"]').exists()).toBe(true);
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

  it('says so when the source is not there, instead of a blank screen', async () => {
    const { wrapper } = await mountAt(
      IncomeSourcePage,
      '/plan/income/99999999-9999-4999-8999-999999999999',
      apiOf((p) => (p === '/income-sources' ? json([sourceDto]) : undefined)),
    );
    await flushPromises();
    expect(wrapper.text()).toContain('Источник не найден');
    expect(wrapper.get('[data-testid="source-back"]').attributes('href')).toBe('/plan?tab=income');
    wrapper.unmount();
  });

  it('disables the ending and the delete confirmation while the write is in flight', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = apiOf((p) => (p === '/income-sources' ? json([sourceDto]) : undefined));
    const slow: Fetch = async (p, init) => {
      if (init?.method === 'PATCH') await gate;
      return base(p, init);
    };
    const { wrapper } = await mountAt(IncomeSourcePage, `/plan/income/${sourceDto.id}`, slow);
    await flushPromises();
    await wrapper.get('[data-testid="source-end"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="source-end"]').attributes('disabled')).toBeDefined();
    release();
    await flushPromises();
    expect(wrapper.get('[data-testid="source-end"]').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });
});
