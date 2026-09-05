import { useEffect, useState } from 'react';

// `100vh`/`h-full` don't shrink when the on-screen keyboard opens on mobile,
// so a plain flex-column page ends up taller than the visible area — the
// browser scrolls the whole page to keep the focused input in view, carrying
// the header off-screen with it. Tracking `visualViewport` and sizing the
// page to it keeps the layout glued to what's actually visible.
export function useKeyboardAwareHeight(active: boolean) {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      setHeight(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);

  return height;
}
