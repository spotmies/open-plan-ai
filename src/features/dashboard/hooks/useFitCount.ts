import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Reports how many of a container's children are fully visible inside its clamped
 * height, instead of relying on a hardcoded item cap that either overflows small or
 * zoomed viewports, or under-fills large ones.
 *
 * Callers must always render the FULL item list inside the container (never sliced) —
 * `containerRef` should go on a `flex-1 min-h-0 overflow-hidden` element. Overflow is
 * always clipped by CSS regardless of measurement timing, so nothing ever visually
 * overflows even mid-resize; `fitCount` is only used to size the trailing "N more"
 * affordance, and grows back automatically once more space becomes available because
 * every row is already mounted.
 */
export function useFitCount(total: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitCount, setFitCount] = useState(total);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || total === 0) {
      setFitCount(total);
      return;
    }

    const recompute = () => {
      const available = container.clientHeight;
      const children = Array.from(container.children) as HTMLElement[];
      let fit = 0;
      for (const child of children) {
        if (child.offsetTop + child.offsetHeight <= available + 0.5) {
          fit++;
        } else {
          break;
        }
      }
      const next = Math.min(fit, total);
      setFitCount((prev) => (prev === next ? prev : next));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [total]);

  return { containerRef, fitCount: Math.min(fitCount, total) };
}
