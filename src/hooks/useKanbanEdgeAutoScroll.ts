import { useCallback, useRef } from 'react';

const EDGE_SIZE = 70;
const MAX_SPEED_PX_PER_SEC = 900;
const RAMP_UP_MS = 550;

/**
 * @hello-pangea/dnd only auto-scrolls the closest scrollable ancestor to the
 * dragged item. Kanban columns have their own vertical scroller nested inside
 * the board's horizontal scroller, so the library's built-in auto-scroll
 * never reaches the outer container — dragging a card toward an off-screen
 * column does nothing. This drives that outer scroll manually from pointer
 * position while a drag is in progress.
 *
 * Speed ramps up over time (not just proximity to the edge) so the scroll
 * starts gently: without the ramp, content shoots past the target column
 * before the user has a chance to react and move the pointer onto it.
 *
 * Side effect: once we scroll the container ourselves, @hello-pangea/dnd's
 * cached position for the dragged card goes stale (it doesn't re-measure for
 * scrolls on this ancestor), so its own `destination` can name the wrong
 * column. `getLastPointerPosition` lets the caller hit-test the real DOM
 * element under the pointer at drop time instead of trusting that value.
 */
export function useKanbanEdgeAutoScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerRectRef = useRef<DOMRect | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointerXRef = useRef<number | null>(null);
  const pointerYRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const zoneDirectionRef = useRef<0 | 1 | -1>(0);
  const zoneEnteredAtRef = useRef<number | null>(null);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    pointerXRef.current = event.clientX;
    pointerYRef.current = event.clientY;
  }, []);

  const handleResize = useCallback(() => {
    containerRectRef.current = containerRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const tick = useCallback((time: number) => {
    const rect = containerRectRef.current;
    const pointerX = pointerXRef.current;
    if (!rect || pointerX === null) {
      frameRef.current = null;
      lastTimeRef.current = null;
      return;
    }

    const dt = lastTimeRef.current === null ? 0 : time - lastTimeRef.current;
    lastTimeRef.current = time;

    const distFromLeft = pointerX - rect.left;
    const distFromRight = rect.right - pointerX;

    let direction: -1 | 0 | 1 = 0;
    let proximity = 0;
    if (distFromLeft >= 0 && distFromLeft < EDGE_SIZE) {
      direction = -1;
      proximity = 1 - distFromLeft / EDGE_SIZE;
    } else if (distFromRight >= 0 && distFromRight < EDGE_SIZE) {
      direction = 1;
      proximity = 1 - distFromRight / EDGE_SIZE;
    }

    if (direction === 0) {
      zoneDirectionRef.current = 0;
      zoneEnteredAtRef.current = null;
    } else {
      if (zoneDirectionRef.current !== direction) {
        zoneDirectionRef.current = direction;
        zoneEnteredAtRef.current = time;
      }
      const dwell = zoneEnteredAtRef.current === null ? 0 : time - zoneEnteredAtRef.current;
      const ramp = Math.min(1, dwell / RAMP_UP_MS);
      // ease-in on proximity (quadratic) + ramp-up over dwell time: gentle at
      // first contact with the edge, only reaching full speed after a beat.
      const speed = MAX_SPEED_PX_PER_SEC * (proximity * proximity) * ramp;
      if (speed > 0 && dt > 0 && containerRef.current) {
        containerRef.current.scrollLeft += direction * speed * (dt / 1000);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastTimeRef.current = null;
    zoneDirectionRef.current = 0;
    zoneEnteredAtRef.current = null;
    containerRectRef.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('resize', handleResize);
  }, [handlePointerMove, handleResize]);

  const handleDragStart = useCallback(() => {
    // Measured once up front instead of every animation frame: recomputing
    // it per-frame forces a synchronous layout read while @hello-pangea/dnd
    // is already busy repositioning elements for the drag, which is what
    // made dragging feel stuttery. The container's own screen position
    // doesn't change from scrolling it, only window resizes affect it.
    containerRectRef.current = containerRef.current?.getBoundingClientRect() ?? null;
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    frameRef.current = requestAnimationFrame(tick);
  }, [handlePointerMove, handleResize, tick]);

  const handleDragEnd = useCallback(() => {
    stop();
    pointerXRef.current = null;
    pointerYRef.current = null;
  }, [stop]);

  const getLastPointerPosition = useCallback(() => {
    if (pointerXRef.current === null || pointerYRef.current === null) return null;
    return { x: pointerXRef.current, y: pointerYRef.current };
  }, []);

  return { containerRef, handleDragStart, handleDragEnd, getLastPointerPosition };
}

/**
 * Resolves which kanban column (marked with `data-kanban-column-id`) is
 * really under a given screen point during a drag.
 *
 * DOM hit-testing (`elementFromPoint`/`elementsFromPoint`) is unreliable here:
 * @hello-pangea/dnd renders the dragged card's preview as a fixed-position
 * clone that follows the cursor and sits on top of everything, but it's
 * still a DOM descendant of its *source* column, so hit-testing can walk
 * back up to the wrong column depending on stacking order. Instead, we
 * measure each column's own live bounding rect directly and check which one
 * geometrically contains the point — this doesn't care what's rendered on
 * top, so it can't be fooled by the preview.
 */
export function resolveKanbanColumnIdAtPoint(x: number, y: number): string | undefined {
  const columnEls = document.querySelectorAll<HTMLElement>('[data-kanban-column-id]');
  for (const el of columnEls) {
    const rect = el.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return el.dataset.kanbanColumnId;
    }
  }
  return undefined;
}
