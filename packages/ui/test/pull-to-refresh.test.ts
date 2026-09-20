import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import PullToRefresh from '../src/components/pull-to-refresh/PullToRefresh.vue';
import {
  PULL_MAX,
  PULL_THRESHOLD,
  pullOffset,
  pullPhase,
  pullProgress,
} from '../src/components/pull-to-refresh/pull';

const touch = (clientY: number) => ({ touches: [{ clientY }] });

const mountIt = (props: Record<string, unknown> = {}) =>
  mount(PullToRefresh, {
    props,
    slots: { default: '<ul data-testid="list"><li>one</li></ul>' },
    attachTo: document.body,
  });

/** A pull far enough to cross the threshold, given the resistance curve. */
const PAST_THRESHOLD = 200;

async function pull(w: ReturnType<typeof mountIt>, to: number) {
  await w.trigger('touchstart', touch(0));
  w.element.dispatchEvent(
    Object.assign(new Event('touchmove', { bubbles: true, cancelable: true }), touch(to)),
  );
  await nextTick();
}

describe('pull arithmetic', () => {
  it('follows the finger with growing resistance and never passes the ceiling', () => {
    expect(pullOffset(0)).toBe(0);
    expect(pullOffset(-20)).toBe(0);
    // Early travel is close to one-to-one, late travel is heavily damped.
    expect(pullOffset(10)).toBeGreaterThan(9);
    expect(pullOffset(10)).toBeLessThan(10);
    expect(pullOffset(10_000)).toBeLessThanOrEqual(PULL_MAX);
    expect(pullOffset(400)).toBeGreaterThan(pullOffset(200));
  });

  it('names the three states the indicator draws', () => {
    expect(pullPhase(0)).toBe('idle');
    expect(pullPhase(PULL_THRESHOLD - 1)).toBe('pulling');
    expect(pullPhase(PULL_THRESHOLD)).toBe('ready');
  });

  it('reports progress as a fraction of the threshold, clamped', () => {
    expect(pullProgress(0)).toBe(0);
    expect(pullProgress(PULL_THRESHOLD / 2)).toBeCloseTo(0.5);
    expect(pullProgress(PULL_THRESHOLD * 3)).toBe(1);
  });
});

describe('PullToRefresh', () => {
  it('refreshes when a pull past the threshold is released', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const w = mountIt({ onRefresh });
    await pull(w, PAST_THRESHOLD);
    expect(w.attributes('data-phase')).toBe('ready');
    await w.trigger('touchend');
    expect(onRefresh).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it('lets a short pull spring back without refreshing', async () => {
    const onRefresh = vi.fn();
    const w = mountIt({ onRefresh });
    await pull(w, 10);
    expect(w.attributes('data-phase')).toBe('pulling');
    await w.trigger('touchend');
    expect(onRefresh).not.toHaveBeenCalled();
    expect(w.attributes('data-phase')).toBe('idle');
    w.unmount();
  });

  it('ignores an upward drag, leaving the scroll alone', async () => {
    const onRefresh = vi.fn();
    const w = mountIt({ onRefresh });
    await pull(w, -120);
    expect(w.attributes('data-phase')).toBe('idle');
    await w.trigger('touchend');
    expect(onRefresh).not.toHaveBeenCalled();
    w.unmount();
  });

  it('stays out of the way when the page is scrolled down', async () => {
    const doc = document.scrollingElement ?? document.documentElement;
    Object.defineProperty(doc, 'scrollTop', { value: 240, configurable: true });
    const onRefresh = vi.fn();
    const w = mountIt({ onRefresh });
    await pull(w, PAST_THRESHOLD);
    expect(w.attributes('data-phase')).toBe('idle');
    await w.trigger('touchend');
    expect(onRefresh).not.toHaveBeenCalled();
    w.unmount();
    Object.defineProperty(doc, 'scrollTop', { value: 0, configurable: true });
  });

  it('ignores a second gesture while one is running', async () => {
    let release!: () => void;
    const onRefresh = vi.fn(() => new Promise<void>((r) => (release = r)));
    const w = mountIt({ onRefresh });
    await pull(w, PAST_THRESHOLD);
    await w.trigger('touchend');
    await nextTick();
    expect(w.attributes('data-phase')).toBe('refreshing');

    await pull(w, PAST_THRESHOLD);
    await w.trigger('touchend');
    expect(onRefresh).toHaveBeenCalledTimes(1);

    release();
    await nextTick();
    await nextTick();
    expect(w.attributes('data-phase')).toBe('idle');
    w.unmount();
  });

  it('takes the pending state from outside when the caller owns it', async () => {
    const w = mountIt({ refreshing: true });
    expect(w.attributes('data-phase')).toBe('refreshing');
    expect(w.get('[role="status"]').text()).toBe('Refreshing');
    await w.setProps({ refreshing: false });
    expect(w.attributes('data-phase')).toBe('idle');
    expect(w.get('[role="status"]').text()).toBe('');
    w.unmount();
  });

  it('does nothing when disabled', async () => {
    const onRefresh = vi.fn();
    const w = mountIt({ onRefresh, disabled: true });
    await pull(w, PAST_THRESHOLD);
    await w.trigger('touchend');
    expect(onRefresh).not.toHaveBeenCalled();
    w.unmount();
  });

  it('exposes refresh() so a button can stand in for the gesture', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const w = mountIt({ onRefresh });
    await (w.vm as unknown as { refresh: () => Promise<void> }).refresh();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it('renders its content untouched on a pointer device that never fires a touch', () => {
    const w = mountIt();
    expect(w.get('[data-testid="list"]').text()).toBe('one');
    expect(w.attributes('data-phase')).toBe('idle');
    w.unmount();
  });
});
