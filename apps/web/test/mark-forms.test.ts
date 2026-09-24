import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import GoalFormPage from '../src/modules/goals/ui/GoalFormPage.vue';
import AssetFormPage from '../src/modules/assets/ui/AssetFormPage.vue';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

const GOAL_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '44444444-4444-4444-8444-444444444444';
const goalDto = (over: object = {}) => ({
  id: GOAL_ID,
  name: 'Машина',
  icon: null,
  color: null,
  targetAmount: '10000',
  currency: 'USD',
  targetDate: null,
  achievedAt: null,
  archivedAt: null,
  sortOrder: 0,
  ...over,
});
const assetDto = (over: object = {}) => ({
  id: ASSET_ID,
  name: 'Часы',
  icon: null,
  color: null,
  currency: 'USD',
  countsInTotal: false,
  acquiredOn: null,
  purchasePrice: null,
  archivedAt: null,
  value: null,
  valuedOn: null,
  ...over,
});

const body = () => new DOMWrapper(document.body);
const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises();
};

/** Opens the sheet from the disc beside the name, picks, and closes it. */
async function pick(
  wrapper: { get: (s: string) => { trigger: (e: string) => Promise<void> } },
  emoji: string,
  color: string,
) {
  await wrapper.get('[data-testid="mark-open"]').trigger('click');
  await flushPromises();
  await body().get(`[data-testid="mark-emoji-${emoji}"]`).trigger('click');
  await body().get(`[data-testid="mark-color-${color}"]`).trigger('click');
  await body().get('[data-testid="mark-done"]').trigger('click');
  await flushPromises();
}

const recording = (list: string, dto: (o?: object) => object, existing: object[] = []) => {
  const writes: { method: string; body: Record<string, unknown> }[] = [];
  const fetch = apiOf((p, init) => {
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      const b = JSON.parse(String(init?.body)) as Record<string, unknown>;
      writes.push({ method, body: b });
      return json(dto(b), method === 'POST' ? 201 : 200);
    }
    return p === list ? json(existing) : undefined;
  });
  return { fetch, writes };
};

describe('choosing the mark in the goal form', () => {
  it('shows the choice on the disc and sends it with the new goal', async () => {
    const { fetch, writes } = recording('/goals', goalDto);
    const { wrapper } = await mountAt(GoalFormPage, '/goals/new', fetch);
    await settle();

    await wrapper.get('[data-testid="goal-name"]').setValue('Машина');
    expect(wrapper.get('[data-testid="mark-open"] [data-slot="mark-disc"]').text()).toBe('М');
    await pick(wrapper, '🚗', 'teal');
    const disc = wrapper.get('[data-testid="mark-open"] [data-slot="mark-disc"]');
    expect(disc.text()).toBe('🚗');
    expect(disc.attributes('data-color')).toBe('teal');

    await wrapper.get('[data-testid="goal-target"]').setValue('10000');
    await wrapper.get('[data-testid="goal-form"]').trigger('submit');
    await settle();

    expect(writes).toHaveLength(1);
    expect(writes[0]?.body).toMatchObject({ name: 'Машина', icon: '🚗', color: 'teal' });
    wrapper.unmount();
  });

  it('keeps the mark a goal already has, and sends none for a goal that has none', async () => {
    const marked = recording('/goals', goalDto, [goalDto({ icon: '🏖️', color: 'pink' })]);
    const a = await mountAt(GoalFormPage, `/goals/${GOAL_ID}/edit`, marked.fetch);
    await settle();
    expect(a.wrapper.get('[data-testid="mark-open"] [data-slot="mark-disc"]').text()).toBe('🏖️');
    await a.wrapper.get('[data-testid="goal-form"]').trigger('submit');
    await settle();
    expect(marked.writes[0]?.body).toMatchObject({ icon: '🏖️', color: 'pink' });
    a.wrapper.unmount();

    const plain = recording('/goals', goalDto, [goalDto()]);
    const b = await mountAt(GoalFormPage, `/goals/${GOAL_ID}/edit`, plain.fetch);
    await settle();
    await b.wrapper.get('[data-testid="goal-form"]').trigger('submit');
    await settle();
    expect(plain.writes[0]?.body).toMatchObject({ icon: null, color: null });
    b.wrapper.unmount();
  });

  it('names what the disc button does, since the disc itself is silent', async () => {
    const { fetch } = recording('/goals', goalDto);
    const { wrapper } = await mountAt(GoalFormPage, '/goals/new', fetch);
    await settle();
    expect(wrapper.get('[data-testid="mark-open"]').attributes('aria-label')).toBe(
      'Выбрать значок и цвет',
    );
    wrapper.unmount();
  });
});

describe('choosing the mark in the asset form', () => {
  it('sends the choice with the new asset', async () => {
    const { fetch, writes } = recording('/assets', assetDto);
    const { wrapper } = await mountAt(AssetFormPage, '/assets/new', fetch);
    await settle();

    await wrapper.get('[data-testid="asset-name"]').setValue('Часы');
    await pick(wrapper, '⌚', 'amber');
    await wrapper.get('[data-testid="asset-form"]').trigger('submit');
    await settle();

    expect(writes).toHaveLength(1);
    expect(writes[0]?.body).toMatchObject({ name: 'Часы', icon: '⌚', color: 'amber' });
    wrapper.unmount();
  });
});
