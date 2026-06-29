interface GoldDividerProps {
  orientation?: "horizontal" | "vertical";
  length?: number | string;
  thickness?: number;
  className?: string;
}

/**
 * 描金分隔线 — Phase 1 装饰元素
 *
 * 借鉴 V3 标题抬头的细节:核心线条 + 两端如意收尾 + 中央节点。
 * 凡是标题与内容之间、面板分区之间都该用它。
 */
export function GoldDivider({
  orientation = "horizontal",
  length = "100%",
  thickness = 1,
  className,
}: GoldDividerProps) {
  const isHoriz = orientation === "horizontal";
  const width = isHoriz ? length : thickness;
  const height = isHoriz ? thickness : length;

  return (
    <svg
      className={className}
      style={{
        display: "block",
        width,
        height,
        flexShrink: 0,
        color: "var(--color-gold-line)",
      }}
      viewBox={isHoriz ? "0 0 200 8" : "0 0 8 200"}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        x1="4"
        y1={isHoriz ? 4 : 4}
        x2={isHoriz ? 196 : 4}
        y2={isHoriz ? 4 : 196}
        stroke="currentColor"
        strokeWidth={1}
        opacity="0.65"
      />
      {isHoriz ? (
        <>
          <circle cx="4" cy="4" r="2" fill="currentColor" />
          <circle cx="196" cy="4" r="2" fill="currentColor" />
          <circle cx="100" cy="4" r="2.4" fill="currentColor" />
          <circle cx="100" cy="4" r="1" fill="var(--color-yuebai)" />
        </>
      ) : (
        <>
          <circle cx="4" cy="4" r="2" fill="currentColor" />
          <circle cx="4" cy="196" r="2" fill="currentColor" />
          <circle cx="4" cy="100" r="2.4" fill="currentColor" />
          <circle cx="4" cy="100" r="1" fill="var(--color-yuebai)" />
        </>
      )}
    </svg>
  );
}
