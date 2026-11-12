import { useNavigate } from "react-router-dom";
import { Box } from "@mui/material";

import { useMarketTickers } from "@/apis/av/joyu_market.ts";
import { limitState, stockActressPath } from "@/helpers/joyuMarket.ts";

/**
 * 女優卡照片右下角的上市標示：代碼＋現價＋漲跌幅（深色半透明底，漲紅跌綠；漲跌停整顆反白）。沒上市就不顯示。
 * 卡片本身是連到女優頁的 <a>，標示不能再包一層連結，改成點了用 navigate 直接到她的「股票」分頁
 */
export function ActressStockTag({
  name,
  domain,
  aid,
}: {
  name: string;
  domain: string;
  aid: number;
}) {
  const navigate = useNavigate();
  const t = useMarketTickers().data?.get(`${domain}:${aid}`);
  if (!t) return null;
  const pct = t.prev_close
    ? ((t.price - t.prev_close) / t.prev_close) * 100
    : 0;
  const limit = limitState(t.price, t.prev_close);
  const arrow = pct > 0.004 ? "▲ +" : pct < -0.004 ? "▼ " : "";
  return (
    <Box
      component="span"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(stockActressPath({ aid, domain, name }));
      }}
      role="link"
      sx={{
        alignItems: "center",
        backdropFilter: "blur(2px)",
        bgcolor:
          limit === "up"
            ? "error.main"
            : limit === "down"
              ? "success.main"
              : "rgba(17, 12, 20, 0.78)",
        borderRadius: 999,
        bottom: 6,
        color: limit
          ? "#fff"
          : pct > 0.004
            ? "#ff8a80"
            : pct < -0.004
              ? "#9ccc65"
              : "#fff",
        cursor: "pointer",
        display: "inline-flex",
        fontSize: 11,
        fontVariantNumeric: "tabular-nums",
        fontWeight: 700,
        gap: 0.5,
        position: "absolute",
        px: 0.875,
        py: 0.25,
        right: 6,
        whiteSpace: "nowrap",
        zIndex: 1,
      }}
    >
      <Box
        component="span"
        sx={{ color: "rgba(255,255,255,.75)", fontWeight: 600 }}
      >
        {t.code}
      </Box>
      {t.price.toFixed(2)} {arrow}
      {pct.toFixed(2)}%
    </Box>
  );
}
