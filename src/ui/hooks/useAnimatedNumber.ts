import { useEffect, useRef, useState } from "react";

/**
 * 数字滚动 hook — Phase 6
 *
 * 当 target 变化时,从 current 平滑过渡到 target,返回当前显示值。
 * 尊重 prefers-reduced-motion,直接跳到目标值。
 */
export function useAnimatedNumber(target: number, durationMs = 300): number {
  const [display, setDisplay] = useState(target);
  const startRef = useRef<number>(target);
  const targetRef = useRef<number>(target);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === targetRef.current) return;

    // 尊重 prefers-reduced-motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      targetRef.current = target;
      startRef.current = target;
      setDisplay(target);
      return;
    }

    startRef.current = targetRef.current;
    targetRef.current = target;
    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const value = startRef.current + (targetRef.current - startRef.current) * eased;
      setDisplay(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(targetRef.current);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return display;
}
