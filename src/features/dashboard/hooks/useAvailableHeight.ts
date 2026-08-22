import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures the actual pixel space between an element's top and the bottom of the
 * viewport, so callers can lock content to exactly that height instead of relying on
 * nested flex/grid stretch behavior (which is easy to get subtly wrong across many
 * nested levels, and silently falls back to "grow with content" — i.e. scrolling —
 * the moment one link in that chain is off).
 *
 * Recomputes on window resize and after every render (cheap: one getBoundingClientRect
 * call), so it stays correct as sibling content (banners, loading states) changes the
 * element's position without needing to track every possible dependency by hand.
 */
export function useAvailableHeight(minHeight = 240, bottomGap = 16) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const recompute = () => {
      const top = el.getBoundingClientRect().top;
      const next = Math.max(minHeight, Math.floor(window.innerHeight - top - bottomGap));
      setHeight((prev) => (prev === next ? prev : next));
    };

    recompute();
    window.addEventListener('resize', recompute);
    const raf = window.requestAnimationFrame(recompute);
    return () => {
      window.removeEventListener('resize', recompute);
      window.cancelAnimationFrame(raf);
    };
  });

  return { ref, height };
}
