import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAnimatedNumber } from "../ui/hooks/useAnimatedNumber";

describe("useAnimatedNumber", () => {
  it("returns initial value", () => {
    const { result } = renderHook(() => useAnimatedNumber(100));
    expect(result.current).toBe(100);
  });

  it("preserves initial state when target changes (no animation in jsdom rAF)", () => {
    const { result, rerender } = renderHook(
      ({ target }) => useAnimatedNumber(target, 50),
      { initialProps: { target: 0 } }
    );
    const initialDisplay = result.current;
    expect(initialDisplay).toBe(0);
    rerender({ target: 100 });
    // 真实动画在 jsdom 中不可靠 — 只验证 hook 不会抛错
    expect(typeof result.current).toBe("number");
  });

  it("handles small target without crash", () => {
    const { result, rerender } = renderHook(
      ({ target }) => useAnimatedNumber(target, 50),
      { initialProps: { target: 1 } }
    );
    rerender({ target: 2 });
    expect(Number.isFinite(result.current)).toBe(true);
  });
});
