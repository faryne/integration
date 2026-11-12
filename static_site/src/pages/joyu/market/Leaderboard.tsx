import { Link as RouterLink } from "react-router-dom";
import {
  Link,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import {
  useMarketLeaderboard,
  useMarketWallet,
} from "@/apis/av/joyu_market.ts";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { ErrorSnack } from "@/components/joyu/home/ErrorSnack.tsx";
import { useMarketUid } from "@/components/joyu/market/useMarketUid.ts";
import {
  changeColor,
  money,
  signedPct,
  stockPath,
} from "@/helpers/joyuMarket.ts";
import { useTitle } from "@/helpers/title.tsx";

const num = {
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
} as const;

/**
 * joyu 女優股市排行榜（/market/leaderboard）：總資產前 50 名（現金＋持股照現價算，5 分鐘更新一次），
 * 名字是暱稱，沒設暱稱的顯示匿名代號；Google 帳號登入時上面多一行自己的排名
 */
export function JoyuMarketLeaderboard() {
  useTitle("排行榜");
  const board = useMarketLeaderboard();
  const { uid } = useMarketUid();
  const wallet = useMarketWallet(uid);
  const me = wallet.data;

  return (
    <AgeConfirmationGate
      description="joyu.fyi 包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      panelTitle="joyu.fyi 需要年齡確認"
    >
      <Stack spacing={2} sx={{ textAlign: "left" }}>
        <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800 }}>
          排行榜
        </Typography>
        {me && (
          <Paper sx={{ p: 1.5 }} variant="outlined">
            <Typography sx={{ fontWeight: 700, ...num }}>
              我的排名 #{me.rank}・總資產 {money(me.total)}{" "}
              <Typography
                component="span"
                sx={{ color: changeColor(me.return_pct), fontWeight: 700 }}
              >
                {signedPct(me.return_pct)}
              </Typography>
            </Typography>
          </Paper>
        )}
        <Paper
          sx={{ overflowX: "auto", p: { xs: 1, md: 2 } }}
          variant="outlined"
        >
          {board.isPending ? (
            <Skeleton height={300} variant="rounded" />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>名次</TableCell>
                  <TableCell>暱稱</TableCell>
                  <TableCell align="right">總資產</TableCell>
                  <TableCell align="right">報酬率</TableCell>
                  <TableCell>最大持股</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(board.data ?? []).map((r) => (
                  <TableRow key={r.rank}>
                    <TableCell sx={{ fontWeight: 800, ...num }}>
                      {r.rank}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {r.name}
                    </TableCell>
                    <TableCell align="right" sx={num}>
                      {money(r.total)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: changeColor(r.return_pct), ...num }}
                    >
                      {signedPct(r.return_pct)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {r.top_code && (
                        <Link
                          component={RouterLink}
                          to={stockPath(r.top_code)}
                          underline="hover"
                        >
                          {r.top_name}
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Stack>
      <ErrorSnack message="排行榜讀取失敗，請稍後再試" open={board.isError} />
    </AgeConfirmationGate>
  );
}
