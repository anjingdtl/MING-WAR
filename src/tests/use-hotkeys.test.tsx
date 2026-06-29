import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHotkeys } from "../ui/hooks/useHotkeys";
import { fireEvent } from "@testing-library/react";

describe("useHotkeys", () => {
  it("calls handler on matching key", () => {
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ key: "1", handler }])
    );
    fireEvent.keyDown(document, { key: "1" });
    expect(handler).toHaveBeenCalled();
  });

  it("ignores non-matching keys", () => {
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ key: "1", handler }])
    );
    fireEvent.keyDown(document, { key: "2" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores input element by default", () => {
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ key: "1", handler }])
    );
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "1" });
    document.body.removeChild(input);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not ignore input when ignoreInputs=false", () => {
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ key: "1", handler, ignoreInputs: false }])
    );
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "1" });
    document.body.removeChild(input);
    expect(handler).toHaveBeenCalled();
  });

  it("calls preventDefault by default", () => {
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ key: "1", handler }])
    );
    const event = new KeyboardEvent("keydown", { key: "1", cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("respects preventDefault=false", () => {
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ key: "1", handler, preventDefault: false }])
    );
    const event = new KeyboardEvent("keydown", { key: "1", cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("removes listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useHotkeys([{ key: "1", handler }])
    );
    unmount();
    fireEvent.keyDown(document, { key: "1" });
    expect(handler).not.toHaveBeenCalled();
  });
});
