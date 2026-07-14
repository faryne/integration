import type { CSSProperties } from "react";

/**
 * 用三角函數算出齒輪多邊形的頂點，不手刻長長的 SVG path——齒數/內外半徑可調，
 * GearIcon 跟 SteamLoomMark 共用這份計算。
 */
function gearPolygonPoints(
  teeth: number,
  outerR: number,
  innerR: number,
  cx: number,
  cy: number,
): string {
  const points: string[] = [];
  const step = (Math.PI * 2) / (teeth * 2);
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
}

/** 純裝飾用的齒輪圖形，顏色跟著外層 `color` 走（用 currentColor）。 */
export function GearIcon({
  teeth = 10,
  outerR = 46,
  innerR = 38,
  holeR = 14,
  strokeWidth = 3,
  className,
  style,
}: {
  teeth?: number;
  outerR?: number;
  innerR?: number;
  holeR?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const points = gearPolygonPoints(teeth, outerR, innerR, 50, 50);
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <polygon
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <circle
        cx={50}
        cy={50}
        r={holeR}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

/** 品牌標誌：齒輪包著一顆線軸，SteamLoom（蒸汽＋紡織）的核心意象。 */
export function SteamLoomMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const gearPoints = gearPolygonPoints(8, 46, 38, 50, 50);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <polygon
        points={gearPoints}
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <g opacity={0.75}>
        <rect x="38" y="30" width="24" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth={4} />
        <line x1="38" y1="40" x2="62" y2="40" stroke="currentColor" strokeWidth={3} />
        <line x1="38" y1="50" x2="62" y2="50" stroke="currentColor" strokeWidth={3} />
        <line x1="38" y1="60" x2="62" y2="60" stroke="currentColor" strokeWidth={3} />
      </g>
    </svg>
  );
}
