import { useEffect, useRef, useState } from 'react';

type Viewport = [number, number, number, number];

export function useViewportTransition(target: Viewport): Viewport {
  const [displayed, setDisplayed] = useState<Viewport>(target);
  const current = useRef<Viewport>(target);
  const [x, y, width, height] = target;
  useEffect(() => {
    const destination: Viewport = [x, y, width, height];
    const source = current.current;
    let frame = 0;
    const motion = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const finish = () => {
      cancelAnimationFrame(frame);
      current.current = destination;
      setDisplayed(destination);
    };
    if (!motion || motion.matches || source.every((value, index) => value === destination[index])) {
      finish();
      return;
    }
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / 280);
      const eased = progress * progress * (3 - 2 * progress);
      const next = source.map((value, index) => value + (destination[index]! - value) * eased) as Viewport;
      current.current = next;
      setDisplayed(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    const reduce = () => { if (motion.matches) finish(); };
    motion.addEventListener('change', reduce);
    frame = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener('change', reduce); };
  }, [x, y, width, height]);
  return displayed;
}
