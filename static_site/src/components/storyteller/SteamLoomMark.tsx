/** 品牌標誌：以交錯經緯線組成織框，取代過度直白的齒輪圖案。 */
export function SteamLoomMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <g transform="rotate(45 50 50)">
        <rect
          x="21"
          y="21"
          width="58"
          height="58"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
        />
        <g opacity={0.72} stroke="currentColor" strokeWidth={3}>
          <line x1="36" y1="15" x2="36" y2="85" />
          <line x1="50" y1="15" x2="50" y2="85" />
          <line x1="64" y1="15" x2="64" y2="85" />
          <line x1="15" y1="43" x2="85" y2="43" />
          <line x1="15" y1="57" x2="85" y2="57" />
        </g>
      </g>
    </svg>
  );
}
