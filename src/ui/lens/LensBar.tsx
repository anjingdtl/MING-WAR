import { Crown, Landmark, MapPin, Scale, Users } from "lucide-react";
import type { LensDefinition, LensId } from "./lensDefinitions";

interface LensBarProps {
  current: LensId;
  onChange: (lens: LensId) => void;
  lenses?: LensDefinition[];
}

const DEFAULT_LENSES: LensDefinition[] = [
  { id: "control", name: "势力", Icon: Crown } as LensDefinition,
  { id: "economy", name: "经济", Icon: Landmark } as LensDefinition,
  { id: "military", name: "军事", Icon: Scale } as LensDefinition,
  { id: "people", name: "民生", Icon: Users } as LensDefinition,
  { id: "court", name: "朝堂", Icon: MapPin } as LensDefinition
];

/**
 * Lens 切换栏 — Phase 3 核心 UI 组件
 *
 * 借鉴 V3 的 5-Lens 范式:左侧垂直栏,5 个按钮,数字 1-5 快捷键。
 * 用 role="tablist" 标准化,符合 a11y 规范。
 */
export function LensBar({ current, onChange, lenses = DEFAULT_LENSES }: LensBarProps) {
  return (
    <nav
      className="lens-bar"
      role="tablist"
      aria-label="视角切换"
      aria-orientation="vertical"
    >
      {lenses.map((lens, idx) => {
        const Icon = lens.Icon;
        const isActive = lens.id === current;
        return (
          <button
            key={lens.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls="lens-content"
            className={`lens-tab ${isActive ? "is-active" : ""}`}
            onClick={() => onChange(lens.id)}
            title={`${lens.name} (${idx + 1})`}
          >
            <Icon aria-hidden="true" size={18} />
            <span className="lens-tab__label">{lens.name}</span>
            <span className="lens-tab__key" aria-hidden="true">{idx + 1}</span>
          </button>
        );
      })}
    </nav>
  );
}
