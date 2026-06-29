import { useEffect } from "react";

export interface Hotkey {
  /** 键名(可读,例如 "1", "Escape", "Shift+/") */
  key: string;
  /** 按下时触发 */
  handler: (e: KeyboardEvent) => void;
  /** 是否忽略输入框内的按键(默认 true) */
  ignoreInputs?: boolean;
  /** 是否阻止默认(默认 true) */
  preventDefault?: boolean;
}

const isInputElement = (el: Element | null): boolean => {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return false;
};

/**
 * 集中快捷键 hook — Phase 6
 *
 * 用法:
 *   useHotkeys([
 *     { key: "1", handler: () => setLens("control") },
 *     { key: "Escape", handler: () => closeAll() }
 *   ]);
 */
export function useHotkeys(hotkeys: Hotkey[]): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const hk of hotkeys) {
        if (e.key !== hk.key) continue;
        if ((hk.ignoreInputs ?? true) && isInputElement(e.target as Element)) continue;
        if (hk.preventDefault !== false) e.preventDefault();
        hk.handler(e);
        return;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hotkeys]);
}
