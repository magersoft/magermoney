import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { API_KEY } from '../src/shared/api/use-api.js';
import { useIncomeSources } from '../src/modules/income/application/use-income-sources.js';
import {
  useCreateIncomeSource,
  useDeleteIncomeSource,
} from '../src/modules/income/application/use-income-source-mutations.js';
import { matchesInflowParams, useInflows } from '../src/modules/income/application/use-inflows.js';
import { inflowDto, sourceDto } from './fixtures/income.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const cur = (code: string) => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: null,
  icon: null,
  rateSource: 'open-er-api',
});

function mountIt(fetchImpl: (path: string, init?: RequestInit) => Promise<Response>) {
  let sources!: ReturnType<typeof useIncomeSources>;
  let create!: ReturnType<typeof useCreateIncomeSource>;
  let remove!: ReturnType<typeof useDeleteIncomeSource>;
  let inflows!: ReturnType<typeof useInflows>;
  const Probe = defineComponent({
    setup() {
      sources = useIncomeSources();
      create = useCreateIncomeSource();
      remove = useDeleteIncomeSource();
      inflows = useInflows(() => ({ from: '2026-09-01', to: '2026-09-30' }));
      return () => h('div');
    },
  });
  mount(Probe, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            }),
          },
        ],
      ],
      provide: { [API_KEY as unknown as string]: { fetch: fetchImpl } },
    },
  });
  return {
    sources: () => sources,
    create: () => create,
    remove: () => remove,
    inflows: () => inflows,
  };
}

describe('income queries', () => {
  it('serves sources as DTOs and as domain objects, and inflows for the asked window', async () => {
    const fetch = vi.fn(async (path: string) => {
      if (path === '/me/currencies') return json([cur('USD')]);
      if (path.startsWith('/inflows')) return json([inflowDto]);
      return json([sourceDto]);
    });
    const p = mountIt(fetch);
    await flushPromises();
    expect(p.sources().dtos.value).toEqual([sourceDto]);
    expect(p.sources().sources.value[0]?.grossAmount.currency.code).toBe('USD');
    expect(p.inflows().inflows.value[0]?.amount.toString()).toBe('500');
    expect(
      fetch.mock.calls.some(
        ([path]) => path === '/inflows?limit=200&from=2026-09-01&to=2026-09-30',
      ),
    ).toBe(true);
  });

  it('shows a created source at once and drops a deleted one', async () => {
    let stored = [sourceDto];
    const second = {
      ...sourceDto,
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Other',
      isPrimary: false,
    };
    const p = mountIt(async (path, init) => {
      if (path === '/me/currencies') return json([cur('USD')]);
      if (path.startsWith('/inflows')) return json([]);
      if (init?.method === 'POST') {
        stored = [...stored, second];
        return json(second, 201);
      }
      if (init?.method === 'DELETE') {
        stored = stored.filter((s) => s.id !== second.id);
        return new Response(null, { status: 204 });
      }
      return json(stored);
    });
    await flushPromises();
    await p.create().create({
      name: 'Other',
      grossAmount: '0',
      currency: 'USD',
      taxRate: '0',
      commissionRate: '0',
      payDays: [],
      isPrimary: false,
      activeFrom: '2026-09-17',
    });
    await flushPromises();
    expect(p.sources().dtos.value.map((s) => s.name)).toEqual(['Salary', 'Other']);
    await p.remove().remove(second.id);
    await flushPromises();
    expect(p.sources().dtos.value.map((s) => s.name)).toEqual(['Salary']);
  });
});

describe('matchesInflowParams', () => {
  const row = { receivedOn: '2026-09-10', incomeSourceId: 'a' };
  it('is inclusive at both ends and respects the source filter', () => {
    expect(matchesInflowParams(row, {})).toBe(true);
    expect(matchesInflowParams(row, { from: '2026-09-10', to: '2026-09-10' })).toBe(true);
    expect(matchesInflowParams(row, { from: '2026-09-11' })).toBe(false);
    expect(matchesInflowParams(row, { to: '2026-09-09' })).toBe(false);
    expect(matchesInflowParams(row, { sourceId: 'b' })).toBe(false);
  });
});
