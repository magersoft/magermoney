import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useDragReorder } from '../src/modules/currencies/ui/use-drag-reorder.js';

/** Three rows of 60px, stacked from the top of the viewport. */
function listOf(rows = 3): HTMLElement {
  const list = document.createElement('ul');
  for (let i = 0; i < rows; i++) {
    const row = document.createElement('li');
    row.getBoundingClientRect = () => ({ top: i * 60, height: 60 }) as DOMRect;
    list.append(row);
  }
  return list;
}

function press(clientY: number): PointerEvent {
  return {
    button: 0,
    clientY,
    pointerId: 1,
    target: document.createElement('button'),
    preventDefault: () => {},
  } as unknown as PointerEvent;
}

const move = (clientY: number) => window.dispatchEvent(new MouseEvent('pointermove', { clientY }));
const release = () => window.dispatchEvent(new MouseEvent('pointerup'));

describe('useDragReorder', () => {
  it('reports where the row was dropped, once, on release', () => {
    const onDrop = vi.fn();
    const list = ref<HTMLElement | null>(listOf());
    const drag = useDragReorder(list, onDrop);

    drag.start(press(30), 0);
    move(160); // past the middle of the third row
    expect(onDrop).not.toHaveBeenCalled();
    release();

    expect(onDrop).toHaveBeenCalledExactlyOnceWith(0, 2);
    expect(drag.dragging.value).toBeNull();
  });

  it('says nothing when the row is let go where it was picked up', () => {
    const onDrop = vi.fn();
    const drag = useDragReorder(ref(listOf()), onDrop);

    drag.start(press(30), 0);
    move(35);
    release();

    expect(onDrop).not.toHaveBeenCalled();
  });

  it('moves the dragged row with the pointer and the rest out of its way', () => {
    const drag = useDragReorder(ref(listOf()), vi.fn());

    drag.start(press(150), 2);
    move(10); // 140px up: above the middle of the first row

    expect(drag.offsetOf(2)).toBe(-140);
    expect(drag.offsetOf(0)).toBe(60);
    expect(drag.offsetOf(1)).toBe(60);
  });

  it('does not start on a list of one, or on a right-click', () => {
    const onDrop = vi.fn();
    const one = useDragReorder(ref(listOf(1)), onDrop);
    one.start(press(10), 0);
    expect(one.dragging.value).toBeNull();

    const drag = useDragReorder(ref(listOf()), onDrop);
    drag.start({ ...press(10), button: 2 } as PointerEvent, 0);
    expect(drag.dragging.value).toBeNull();
  });

  it('drops nothing when the gesture is cancelled', () => {
    const onDrop = vi.fn();
    const drag = useDragReorder(ref(listOf()), onDrop);

    drag.start(press(30), 0);
    move(160);
    window.dispatchEvent(new MouseEvent('pointercancel'));

    expect(onDrop).not.toHaveBeenCalled();
    expect(drag.dragging.value).toBeNull();
  });
});
