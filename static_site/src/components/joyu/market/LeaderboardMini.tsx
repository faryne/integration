import { Link as RouterLink } from "react-router-dom";
import { Link, Paper, Typography } from "@mui/material";

import { useMarketLeaderboard } from "@/apis/av/joyu_market.ts";
import { joyuPath } from "@/helpers/joyu.ts";
import { money } from "@/helpers/joyuMarket.ts";

import { MarketLine } from "./MarketLine.tsx";

const TOP = 5;

/** 股市總覽右欄：排行榜前 5 名（還沒人開戶就不顯示） */
export function LeaderboardMini() {
  const board = useMarketLeaderboard();
  const rows = (board.data ?? []).slice(0, TOP);
  if (rows.length === 0) return null;
  return (
    <Paper sx={{ p: 2 }} variant="outlined">
      <Typography component="h2" sx={{ fontSize: 17, fontWeight: 800, mb: 1 }}>
        排行榜
      </Typography>
      {rows.map((r) => (
        <MarketLine
          key={r.rank}
          label={`${r.rank}. ${r.name}`}
          value={money(r.total)}
        />
      ))}
      <Link
        component={RouterLink}
        sx={{ display: "inline-block", fontSize: 13, mt: 1 }}
        to={joyuPath("market/leaderboard")}
        underline="hover"
      >
        看全部 →
      </Link>
    </Paper>
  );
}
