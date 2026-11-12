import { Link as RouterLink } from "react-router-dom";
import { Box, Link, Paper, Skeleton, Typography } from "@mui/material";

import { useMarketWallet } from "@/apis/av/joyu_market.ts";
import { ErrorSnack } from "@/components/joyu/home/ErrorSnack.tsx";
import { joyuPath } from "@/helpers/joyu.ts";
import { changeColor, money, signedPct } from "@/helpers/joyuMarket.ts";

import { MarketLine as Line } from "./MarketLine.tsx";
import { MarketLoginCta } from "./MarketLoginCta.tsx";
import { useMarketUid } from "./useMarketUid.ts";

/** 股市總覽右欄的「我的資產」：Google 帳號顯示現金、持股市值、總資產與報酬率；其他人顯示開戶（登入）按鈕 */
export function MarketAssetCard() {
  const { uid, loading } = useMarketUid();
  const wallet = useMarketWallet(uid);
  if (loading) return null;
  if (!uid) return <MarketLoginCta title="開戶" />;
  const w = wallet.data;
  return (
    <Paper sx={{ p: 2 }} variant="outlined">
      <Typography component="h2" sx={{ fontSize: 17, fontWeight: 800, mb: 1 }}>
        我的資產
      </Typography>
      {!w ? (
        <Skeleton height={100} variant="rounded" />
      ) : (
        <>
          <Line label="現金" value={money(w.cash)} />
          <Line label="持股市值" value={money(w.holdings_value)} />
          <Box sx={{ borderTop: 1, borderColor: "divider", mt: 0.5, pt: 0.5 }}>
            <Line bold label="總資產" value={money(w.total)} />
            <Line
              color={changeColor(w.return_pct)}
              label="報酬率"
              value={signedPct(w.return_pct)}
            />
          </Box>
          <Link
            component={RouterLink}
            sx={{ display: "inline-block", fontSize: 13, mt: 1 }}
            to={joyuPath("me/portfolio")}
            underline="hover"
          >
            我的持股 →
          </Link>
        </>
      )}
      <ErrorSnack message="資產讀取失敗，請稍後再試" open={wallet.isError} />
    </Paper>
  );
}
