import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RouteError from '../src/components/async-fallback/RouteError.vue';
import RouteLoading from '../src/components/async-fallback/RouteLoading.vue';

describe('route fallbacks', () => {
  it('announces loading politely', () => {
    const w = mount(RouteLoading, { props: { label: 'Loading' } });
    expect(w.get('[role="status"]').text()).toContain('Loading');
  });
  it('says what happened and asks for a retry instead of doing it', async () => {
    const w = mount(RouteError, { props: { title: 'Could not load', actionLabel: 'Reload' } });
    expect(w.get('[role="alert"]').text()).toContain('Could not load');
    await w.get('button').trigger('click');
    expect(w.emitted('retry')).toHaveLength(1);
  });
});
