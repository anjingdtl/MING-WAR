import { useEffect, useState } from "react";
import type { GameState, RegionId, RegionState } from "../../core/types";
import type { LensId } from "./lensDefinitions";
import { LENS_BY_ID } from "./lensDefinitions";

interface RegionHoverCardProps {
  regionId: RegionId | null;
  state: GameState;
  lens: LensId;
  /** 屏幕坐标(由父级根据鼠标位置提供) */
  screenX: number;
  screenY: number;
  /** 容器元素(用于边界避让) */
  containerRect: DOMRect | null;
  /** 鼠标是否在地图上(用于显示/隐藏) */
  visible: boolean;
}

/**
 * 区域浮动信息卡 — Phase 3 hover 交互
 *
 * 借鉴 V3 的"Lens 切换后,区域 hover 卡字段也跟着换"逻辑。
 * 延时 200ms 出现,自动避开屏幕边缘。
 */
export function RegionHoverCard({
  regionId,
  state,
  lens,
  screenX,
  screenY,
  containerRect,
  visible
}: RegionHoverCardProps) {
  const [show, setShow] = useState(false);
  const region: RegionState | null = regionId ? state.regions[regionId] : null;

  useEffect(() => {
    if (!visible || !region) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, [visible, region]);

  if (!region || !show) return null;

  const lensDef = LENS_BY_ID[lens];
  const fields = lensDef.hoverFields(region, state);

  // 边界避让:默认在鼠标右下方,顶到右边时改左,顶到底时改上
  const offsetX = 14;
  const offsetY = 14;
  const cardW = 220;
  const cardH = 130;
  let x = screenX + offsetX;
  let y = screenY + offsetY;
  if (containerRect) {
    if (x + cardW > containerRect.right - 4) x = screenX - cardW - offsetX;
    if (y + cardH > containerRect.bottom - 4) y = screenY - cardH - offsetY;
    if (x < containerRect.left + 4) x = containerRect.left + 4;
    if (y < containerRect.top + 4) y = containerRect.top + 4;
  }

  return (
    <div
      className="region-hover-card"
      role="tooltip"
      style={{ left: x, top: y }}
    >
      <header>
        <span className="region-hover-card__lens">{lensDef.name}</span>
        <strong>{region.name}</strong>
      </header>
      <dl>
        {fields.map((f, idx) => (
          <div key={idx} className={`region-hover-card__row region-hover-card__row--${f.tone ?? "default"}`}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
