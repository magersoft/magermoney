/**
 * Dragging a row of a short list into a new place.
 *
 * The list's DOM order never changes while a drag is in progress: every row is
 * where it started, and the movement you see is a transform. That is what keeps
 * the drag from fighting itself — reordering the list under the pointer moves
 * the row out from under the finger holding it, which reads as the row jumping
 * away. The order is committed once, on release, and the list re-renders from
 * the answer the server gives back.
 *
 * Geometry is measured once at the start rather than on every move: a
 * `getBoundingClientRect` per row per pointer event is the usual reason a drag
 * stutters on a phone.
 */
import { ref, type Ref } from 'vue';

export interface DragReorder {
  /** The row being dragged, or `null`. */
  dragging: Readonly<Ref<number | null>>;
  /** How far, in pixels, row `index` should be drawn from where it sits. */
  offsetOf: (index: number) => number;
  /** Start a drag from a pointer press on the handle of row `index`. */
  start: (event: PointerEvent, index: number) => void;
}

export function useDragReorder(
  list: Ref<HTMLElement | null>,
  onDrop: (from: number, to: number) => void,
): DragReorder {
  const dragging = ref<number | null>(null);
  const target = ref<number | null>(null);
  const delta = ref(0);
  let boxes: { top: number; height: number }[] = [];
  let startY = 0;

  function stop() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    dragging.value = null;
    target.value = null;
    delta.value = 0;
  }

  function onMove(event: PointerEvent) {
    const from = dragging.value;
    if (from === null) return;
    delta.value = event.clientY - startY;
    const box = boxes[from] as { top: number; height: number };
    const centre = box.top + box.height / 2 + delta.value;
    /*
     * The row lands after every OTHER row whose middle it has passed. Counting
     * its own middle too would move it a place on the first few pixels of the
     * gesture, before anything has been dragged anywhere.
     */
    const passed = boxes.filter((b, i) => i !== from && b.top + b.height / 2 < centre).length;
    target.value = Math.min(Math.max(passed, 0), boxes.length - 1);
  }

  function onUp() {
    const from = dragging.value;
    const to = target.value;
    stop();
    if (from !== null && to !== null && from !== to) onDrop(from, to);
  }

  function onCancel() {
    stop();
  }

  function start(event: PointerEvent, index: number) {
    /* Left button or a touch; a right-click on a handle is not a drag. */
    if (event.button !== 0) return;
    const rows = list.value ? [...list.value.children] : [];
    if (rows.length < 2) return;
    boxes = rows.map((row) => {
      const rect = row.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    });
    startY = event.clientY;
    dragging.value = index;
    target.value = index;
    delta.value = 0;
    /*
     * The handle sets `touch-action: none`, so the browser will not take the
     * gesture for a scroll; this keeps the events coming if the finger leaves
     * the handle, which on a phone it immediately does.
     */
    (event.target as Element).setPointerCapture?.(event.pointerId);
    event.preventDefault();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  function offsetOf(index: number): number {
    const from = dragging.value;
    const to = target.value;
    if (from === null || to === null) return 0;
    if (index === from) return delta.value;
    const height = (boxes[from] as { height: number }).height;
    if (from < to && index > from && index <= to) return -height;
    if (to < from && index >= to && index < from) return height;
    return 0;
  }

  return { dragging, offsetOf, start };
}
