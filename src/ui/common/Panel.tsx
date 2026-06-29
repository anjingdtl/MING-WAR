import type { ReactNode } from "react";
import { RuyiCorner } from "./decor/RuyiCorner";
import { GoldDivider } from "./decor/GoldDivider";

export type PanelVariant = "glass" | "solid" | "modal";

interface PanelProps {
  title?: ReactNode;
  /** 标题旁的额外信息(eyebrow/类别) */
  eyebrow?: ReactNode;
  /** 标题右侧的额外控件(关闭、tabs 等) */
  actions?: ReactNode;
  children: ReactNode;
  variant?: PanelVariant;
  /** 是否在四角放如意云头(默认开) */
  showCorners?: boolean;
  /** 是否在标题下放描金分隔线(默认开) */
  showDivider?: boolean;
  className?: string;
  /** 容器节点类型 */
  as?: "section" | "div" | "aside" | "article";
}

/**
 * 面板 — Phase 1 基础组件
 *
 * 三种 variant(借鉴 V3 抽屉/模态/气泡):
 *  - glass: 玻璃感半透明(默认,用于地图上的浮动面板)
 *  - solid: 实色月白(用于弹窗)
 *  - modal: 居中模态(用于事件弹窗)
 *
 * 装饰:四角如意云头 + 标题下描金分隔(默认开)
 */
export function Panel({
  title,
  eyebrow,
  actions,
  children,
  variant = "glass",
  showCorners = true,
  showDivider = true,
  className,
  as: As = "section",
}: PanelProps) {
  return (
    <As
      className={["ming-panel", `ming-panel--${variant}`, className].filter(Boolean).join(" ")}
    >
      {showCorners && (
        <>
          <RuyiCorner position="tl" />
          <RuyiCorner position="tr" />
          <RuyiCorner position="bl" />
          <RuyiCorner position="br" />
        </>
      )}
      {(title || eyebrow || actions) && (
        <header className="ming-panel__header">
          <div className="ming-panel__title-group">
            {eyebrow && <div className="ming-panel__eyebrow">{eyebrow}</div>}
            {title && <h3 className="ming-panel__title">{title}</h3>}
          </div>
          {actions && <div className="ming-panel__actions">{actions}</div>}
        </header>
      )}
      {showDivider && (title || eyebrow) && (
        <div className="ming-panel__divider">
          <GoldDivider length="100%" />
        </div>
      )}
      <div className="ming-panel__body">{children}</div>
    </As>
  );
}
