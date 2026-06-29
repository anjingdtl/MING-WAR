interface SealStampProps {
  text: string;
  size?: number;
  color?: string;
  rotate?: number;
  className?: string;
}

/**
 * 印章 — Phase 1 装饰元素
 *
 * 借鉴 V3 的"高优先级按钮加角标"做法,明代化处理为印章。
 * 用在"批准奏折"、"宣战"等关键行动按钮上,作为视觉强调。
 *
 * 默认 4 字以内,过长会缩小字号。
 */
export function SealStamp({
  text,
  size = 28,
  color = "var(--color-imperial-red)",
  rotate = -6,
  className,
}: SealStampProps) {
  const chars = text.slice(0, 4);
  const fontSize = chars.length <= 2 ? size * 0.55 : size * 0.42;

  return (
    <svg
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        transform: `rotate(${rotate}deg)`,
        flexShrink: 0,
      }}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {/* 外框:粗笔方框,印章典型外形 */}
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="4"
        fill="none"
        stroke={color}
        strokeWidth="6"
        opacity="0.9"
      />
      {/* 内框:细笔装饰 */}
      <rect
        x="12"
        y="12"
        width="76"
        height="76"
        rx="2"
        fill="none"
        stroke={color}
        strokeWidth="0.8"
        opacity="0.5"
      />
      {/* 文字 */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="800"
        fill={color}
        fontFamily="var(--font-display)"
        style={{ letterSpacing: "0.05em" }}
      >
        {chars}
      </text>
    </svg>
  );
}
