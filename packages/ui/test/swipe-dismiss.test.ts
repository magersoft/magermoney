/* eslint-disable vue/one-component-per-file -- the stand-in sheet and its host are fixtures. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref, toHandlers } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import QuickActionSheet from '../src/components/quick-action/QuickActionSheet.vue';
import { Sheet as SheetRoot, SheetContent, SheetTitle } from '../src/components/ui/sheet';
import {
  SWIPE_DISTANCE,
  SWIPE_VELOCITY,
  swipeOutcome,
} from '../src/components/swipe-dismiss/swipe';
import { useSwipeDismiss } from '../src/components/swipe-dismiss/use-swipe-dismiss';

describe('swipe arithmetic', () => {
  it('closes a sheet dragged far enough, whatever the speed', () => {
    expect(swipeOutcome({ distance: SWIPE_DISTANCE, velocity: 0, height: 800 })).toBe('dismiss');
    expect(swipeOutcome({ distance: SWIPE_DISTANCE - 1, velocity: 0, height: 800 })).toBe('settle');
  });

  it('asks a short sheet for a third of its height rather than the full distance', () => {
    expect(swipeOutcome({ distance: 90, velocity: 0, height: 240 })).toBe('dismiss');
    expect(swipeOutcome({ distance: 70, velocity: 0, height: 240 })).toBe('settle');
  });

  it('closes on a flick, but not on a flick that barely moved', () => {
    expect(swipeOutcome({ distance: 30, velocity: SWIPE_VELOCITY, height: 800 })).toBe('dismiss');
    expect(swipeOutcome({ distance: 8, velocity: SWIPE_VELOCITY * 3, height: 800 })).toBe('settle');
  });

  it('never closes on an upward drag', () => {
    expect(swipeOutcome({ distance: -300, velocity: 5, height: 800 })).toBe('settle');
  });
});

const Sheet = defineComponent({
  props: { onDismiss: { type: Function, required: true } },
  setup(props) {
    const swipe = useSwipeDismiss(() => props.onDismiss());
    return () =>
      h('div', { ...toHandlers(swipe), 'data-testid': 'sheet' }, [
        h('p', 'body'),
        h('textarea', { 'data-testid': 'note' }),
      ]);
  },
});

const at = (clientY: number, clientX = 0) => ({ touches: [{ clientY, clientX }] });
function touchEvent(type: string, target: Element, clientY?: number, clientX = 0) {
  const e = Object.assign(
    new Event(type, { bubbles: true, cancelable: true }),
    clientY === undefined ? { touches: [] } : at(clientY, clientX),
  );
  target.dispatchEvent(e);
  return e;
}

describe('useSwipeDismiss', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function drag(target: Element, to: number, x = 0) {
    touchEvent('touchstart', target, 0);
    touchEvent('touchmove', target, to / 2, x / 2);
    const move = touchEvent('touchmove', target, to, x);
    touchEvent('touchend', target);
    vi.runAllTimers();
    return move;
  }

  /* The listeners go on once the sheet is in the document, a tick after mount. */
  async function mountSheet(onDismiss: () => void) {
    const w = mount(Sheet, { props: { onDismiss }, attachTo: document.body });
    await nextTick();
    return w;
  }

  it('closes the sheet when it is dragged down far enough', async () => {
    const onDismiss = vi.fn();
    const w = await mountSheet(onDismiss);
    const move = drag(w.get('p').element, 400);

    expect(move.defaultPrevented).toBe(true);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    w.unmount();
  });

  it('follows the finger while it drags, and settles back when let go short', async () => {
    const onDismiss = vi.fn();
    const w = await mountSheet(onDismiss);
    const sheet = w.get('[data-testid="sheet"]').element as HTMLElement;
    const p = w.get('p').element;

    touchEvent('touchstart', p, 0);
    touchEvent('touchmove', p, 20);
    expect(sheet.style.transform).toBe('translate3d(0, 20px, 0)');

    touchEvent('touchend', p);
    vi.runAllTimers();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe('');
    w.unmount();
  });

  it('leaves a sideways drag alone', async () => {
    const onDismiss = vi.fn();
    const w = await mountSheet(onDismiss);
    const move = drag(w.get('p').element, 60, 300);

    expect(move.defaultPrevented).toBe(false);
    expect(onDismiss).not.toHaveBeenCalled();
    w.unmount();
  });

  it('leaves a drag inside a text field to the field', async () => {
    const onDismiss = vi.fn();
    const w = await mountSheet(onDismiss);
    drag(w.get('[data-testid="note"]').element, 400);

    expect(onDismiss).not.toHaveBeenCalled();
    w.unmount();
  });

  it('scrolls a sheet that is scrolled down instead of closing it', async () => {
    const onDismiss = vi.fn();
    const w = await mountSheet(onDismiss);
    const sheet = w.get('[data-testid="sheet"]').element as HTMLElement;
    sheet.style.overflowY = 'auto';
    Object.defineProperty(sheet, 'scrollHeight', { value: 2000 });
    Object.defineProperty(sheet, 'clientHeight', { value: 500 });
    Object.defineProperty(sheet, 'scrollTop', { value: 300 });

    const move = drag(w.get('p').element, 400);
    expect(move.defaultPrevented).toBe(false);
    expect(onDismiss).not.toHaveBeenCalled();
    w.unmount();
  });
});

describe('the sheets the app is built from', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    /* jsdom keeps a portal's markup after its component unmounts. */
    document.body.innerHTML = '';
  });

  function swipe(target: Element) {
    touchEvent('touchstart', target, 0);
    touchEvent('touchmove', target, 200);
    touchEvent('touchmove', target, 400);
    touchEvent('touchend', target);
    vi.runAllTimers();
  }

  const mountSide = async (side: 'bottom' | 'right') => {
    const w = mount(
      defineComponent({
        setup() {
          const open = ref(true);
          return () =>
            h(
              SheetRoot,
              { open: open.value, 'onUpdate:open': (v: boolean) => (open.value = v) },
              () =>
                h(SheetContent, { side }, () => [
                  h(SheetTitle, () => 'Период'),
                  h('p', { 'data-testid': 'inside' }, 'body'),
                ]),
            );
        },
      }),
      { attachTo: document.body },
    );
    await flushPromises();
    return w;
  };

  it('closes a bottom sheet dragged down, and shows the grip that says it can be', async () => {
    const w = await mountSide('bottom');
    expect(document.querySelector('[data-slot="sheet-grip"]')).not.toBeNull();

    swipe(document.querySelector('[data-testid="inside"]')!);
    await flushPromises();
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
    w.unmount();
  });

  it('leaves a side sheet to its own exits', async () => {
    const w = await mountSide('right');
    expect(document.querySelector('[data-slot="sheet-grip"]')).toBeNull();

    swipe(document.querySelector('[data-testid="inside"]')!);
    await flushPromises();
    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull();
    w.unmount();
  });

  it('closes the quick action sheet dragged down', async () => {
    const w = mount(QuickActionSheet, {
      props: {
        open: true,
        title: 'Новая операция',
        amount: '0',
        code: 'RUB',
        amountLabel: 'Сумма',
        confirmLabel: 'Добавить',
        closeLabel: 'Закрыть',
      },
      attachTo: document.body,
    });
    await flushPromises();

    swipe(document.querySelector('[data-slot="quick-action-sheet"] header')!);
    expect(w.emitted('update:open')?.at(-1)).toEqual([false]);
    w.unmount();
  });
});
