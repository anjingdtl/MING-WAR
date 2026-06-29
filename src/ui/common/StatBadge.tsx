import type { CSSProperties, ReactNode } from "react";

export type StatBadgeTone = "default" | "warning" | "danger" | "positive";
export type StatBadgeSize = "sm" | "md" | "lg";

interface StatBadgeProps {
  label: string;
  value: string | number;
  /** 趋势:正数显示 ↑ 御黄,负数 ↓ 帝王朱,0/undefined 不显示 */
  trend?: number;
  tone?: StatBadgeTone;
  size?: StatBadgeSize;
  /** 阈值提示(渲染时若 value 低于阈值,自动切 tone) */
  thresholds?: { warning?: number; danger?: number };
  /** 数字格式化:'wan'(除以 10000 显示"万") | 'k'(/1000 显示"千") | 'auto' | 字符串后缀 */
  format?: "wan" | "k" | "auto" | string;
  /** 渲染前的钩子,自定义 value 展示 */
  renderValue?: (raw: string | number) => ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

function formatValue(value: string | number, format?: string): string {
  if (typeof value === "string") return value;
  if (format === "wan") return `${(value / 10000).toFixed(1)}万`;
  if (format === "k") return `${(value / 1000).toFixed(1)}千`;
  if (format === "auto") {
    if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}千`;
    return String(value);
  }
  if (typeof format === "string") {
    return `${value}${format}`;
  }
  return String(value);
}

function effectiveTone(
  value: string | number,
  tone: StatBadgeTone,
  thresholds?: { warning?: number; danger?: number }
): StatBadgeTone {
  if (tone !== "default" || typeof value !== "number" || !thresholds) return tone;
  if (thresholds.danger !== undefined && value <= thresholds.danger) return "danger";
  if (thresholds.warning !== undefined && value <= thresholds.warning) return "warning";
  return "default";
}

function TrendArrow({ trend }: { trend: number }) {
  if (trend === 0) return null;
  const isUp = trend > 0;
  return (
    <span className={`stat-badge__delta stat-badge__delta--${isUp ? "up" : "down"}`}>
      {isUp ? "↑" : "↓"} {Math.abs(trend)}
    </span>
  );
}

/**
 * 数据徽章 v2 — Phase 1 基础组件
 *
 * 相比 v1:
 *  - 新增 trend 趋势箭头(↑ 御黄,↓ 帝王朱)
 *  - 新增 thresholds 阈值提示(value 低于阈值自动切 tone)
 *  - 新增 format 自动格式化(万/千/后缀)
 *  - 新增 size 尺寸档
 */
export function StatBadge({
  label,
  value,
  trend,
  tone = "default",
  size = "md",
  thresholds,
  format,
  renderValue,
  className,
  style,
  title,
}: StatBadgeProps) {
  const finalTone = effectiveTone(value, tone, thresholds);
  const display = renderValue ? renderValue(value) : formatValue(value, format);
  const sizeClass = size === "sm" ? "stat-badge--sm" : size === "lg" ? "stat-badge--lg" : "";

  return (
    <div
      className={["stat-badge", `stat-badge--${finalTone}`, sizeClass, className]
        .filter(Boolean)
        .join(" ")}
      style={style}
      title={title}
    >
      <span>{label}</span>
      <strong>
        {display}
        {trend !== undefined && <TrendArrow trend={trend} />}
      </strong>
    </div>
  );
}
