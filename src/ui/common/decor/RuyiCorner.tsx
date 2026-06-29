import type { CSSProperties } from "react";

interface RuyiCornerProps {
  size?: number;
  position: "tl" | "tr" | "bl" | "br";
  color?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * 如意云头角饰 — Phase 1 装饰元素
 * 借鉴维多利亚3"装饰聚焦在框架和边框"原则,明式化处理。
 *
 * 极简云头纹 SVG,克制的 12 像素半径,用在面板四角的视觉锚点。
 */
export function RuyiCorner({
  size = 18,
  position,
  color = "var(--color-gold-line)",
  className,
  style,
}: RuyiCornerProps) {
  // 旋转基准:左上 0deg、右上 90deg、右下 180deg、左下 270deg
  const rotation = { tl: 0, tr: 90, br: 180, bl: 270 }[position];
  return (
    <svg
      className={className}
      style={{
        position: "absolute",
        width: size,
        height: size,
        pointerEvents: "none",
        transform: `rotate(${rotation}deg)`,
        ...style,
      }}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 22 C 2 14, 8 10, 14 10" />
      <path d="M2 22 C 2 18, 4 16, 8 16" />
      <path d="M6 22 C 6 20, 8 19, 10 19" />
      <circle cx="2" cy="22" r="1.4" fill={color} />
    </svg>
  );
}
