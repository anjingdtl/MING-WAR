import { useEffect, useRef, useState, cloneElement } from "react";
import type { ReactElement, ReactNode } from "react";

export type TooltipVariant = "info" | "predict" | "detail";
export type TooltipPlacement = "top" | "bottom" | "left" | "right" | "auto";

interface TooltipProps {
  /** Tooltip 标题(可选) */
  title?: ReactNode;
  /** Tooltip 内容 */
  content: ReactNode;
  variant?: TooltipVariant;
  placement?: TooltipPlacement;
  /** 出现延时(ms) */
  delay?: number;
  /** 是否禁用(永不显示) */
  disabled?: boolean;
  children: ReactElement;
  className?: string;
}

/**
 * 通用 Tooltip 组件 — Phase 4
 *
 * 三种 variant:
 *  - info: 悬停信息(任何数字、图标、地名)
 *  - predict: 决策预测(切换内政重点/军略目标前的结果预估)
 *  - detail: 详细机制解释(可展开)
 *
 * 出现延时 300ms,默认 placement auto(避开边缘)
 */
export function Tooltip({
  title,
  content,
  variant = "info",
  placement = "auto",
  delay = 300,
  disabled,
  children,
  className
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; place: "top" | "bottom" | "left" | "right" }>({
    x: 0,
    y: 0,
    place: "top"
  });
  const triggerRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const show = () => {
    if (disabled) return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const place = computePlacement(placement, rect);
        let x: number;
        let y: number;
        switch (place) {
          case "top":
            x = rect.left + rect.width / 2;
            y = rect.top;
            break;
          case "bottom":
            x = rect.left + rect.width / 2;
            y = rect.bottom;
            break;
          case "left":
            x = rect.left;
            y = rect.top + rect.height / 2;
            break;
          case "right":
            x = rect.right;
            y = rect.top + rect.height / 2;
            break;
        }
        setPos({ x, y, place });
        setVisible(true);
      }
    }, delay);
  };

  const hide = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  };

  // 把 ref 挂到 children 上 + 监听事件
  const childProps = {
    ref: triggerRef as React.Ref<HTMLElement>,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide
  } as Record<string, unknown>;

  // 处理原 children 上的 onMouseEnter 等(避免覆盖)
  const originalOnMouseEnter = (children.props as { onMouseEnter?: () => void }).onMouseEnter;
  const originalOnMouseLeave = (children.props as { onMouseLeave?: () => void }).onMouseLeave;
  if (originalOnMouseEnter) {
    childProps.onMouseEnter = () => {
      originalOnMouseEnter();
      show();
    };
  }
  if (originalOnMouseLeave) {
    childProps.onMouseLeave = () => {
      originalOnMouseLeave();
      hide();
    };
  }

  const trigger = cloneElement(children, childProps);

  return (
    <>
      {trigger}
      {visible && (
        <div
          role="tooltip"
          className={["ming-tooltip", `ming-tooltip--${variant}`, `ming-tooltip--${pos.place}`, className]
            .filter(Boolean)
            .join(" ")}
          style={{ left: pos.x, top: pos.y }}
        >
          {title && <div className="ming-tooltip__title">{title}</div>}
          <div className="ming-tooltip__body">{content}</div>
        </div>
      )}
    </>
  );
}

function computePlacement(
  requested: TooltipPlacement,
  rect: DOMRect
): "top" | "bottom" | "left" | "right" {
  if (requested !== "auto") return requested;
  // 自动选边:上下都装得下就用 top,否则翻面
  if (rect.top > 200) return "top";
  if (window.innerHeight - rect.bottom > 200) return "bottom";
  return rect.left > window.innerWidth / 2 ? "left" : "right";
}
