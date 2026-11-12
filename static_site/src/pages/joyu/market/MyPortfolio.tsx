import { Link as RouterLink, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  Box,
  Link,
  Pagination,
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

import { useMarketTrades, useMarketWallet } from "@/apis/av/joyu_market.ts";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { ErrorSnack } from "@/components/joyu/home/ErrorSnack.tsx";
import { MarketLoginCta } from "@/components/joyu/market/MarketLoginCta.tsx";
import { useMarketUid } from "@/components/joyu/market/useMarketUid.ts";
import { joyuPath } from "@/helpers/joyu.ts";
import {
  changeColor,
  money,
  signedPct,
  stockActressPath,
  stockPath,
} from "@/helpers/joyuMarket.ts";
import { useTitle } from "@/helpers/title.tsx";

const TRADES_PAGE_SIZE = 30;
const num = {
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
} as const;
const titleSx = { fontSize: 17, fontWeight: 800, mb: 1 } as const;

function Summary({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Paper sx={{ p: 1.5 }} variant="outlined">
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
        {label}
      </Typography>
      <Typography
        sx={{ color, fontSize: { xs: 17, md: 21 }, fontWeight: 800, ...num }}
      >
        {value}
      </Typography>
    </Paper>
  );
}

/**
 * joyu 我的持股（/me/portfolio）：總資產、報酬率、現金、持股市值；各檔持股（股數、可賣、平均成本、現價、市值、損益）；
 * 成交紀錄（新的在前，分頁存在網址 ?page=2）。只限 Google 帳號，其他人顯示登入按鈕。
 * 表格在手機上可以左右捲
 */
export function JoyuMyPortfolio() {
  useTitle("我的持股");
  const { uid, loading } = useMarketUid();
  const [params, setParams] = useSearchParams();
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const wallet = useMarketWallet(uid);
  const trades = useMarketTrades(uid, page);
  const w = wallet.data;
  const pageCount = Math.ceil((trades.data?.total ?? 0) / TRADES_PAGE_SIZE);

  return (
    <AgeConfirmationGate
      description="joyu.fyi 包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      panelTitle="joyu.fyi 需要年齡確認"
    >
      <Stack spacing={2} sx={{ textAlign: "left" }}>
        <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800 }}>
          我的持股
        </Typography>
        {loading ? null : !uid ? (
          <MarketLoginCta title="開戶" />
        ) : !w ? (
          <Skeleton height={200} variant="rounded" />
        ) : (
          <>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(5, minmax(0, 1fr))",
                },
              }}
            >
              <Summary label="總資產" value={money(w.total)} />
              <Summary
                color={changeColor(w.return_pct)}
                label="報酬率"
                value={signedPct(w.return_pct)}
              />
              <Summary label="現金" value={money(w.cash)} />
              <Summary label="持股市值" value={money(w.holdings_value)} />
              <Summary label="排名" value={`#${w.rank}`} />
            </Box>

            <Paper
              sx={{ overflowX: "auto", p: { xs: 1.5, md: 2 } }}
              variant="outlined"
            >
              <Typography component="h2" sx={titleSx}>
                持股
              </Typography>
              {w.holdings.length === 0 ? (
                <Link
                  component={RouterLink}
                  to={joyuPath("market")}
                  underline="hover"
                >
                  去股市 →
                </Link>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>女優</TableCell>
                      <TableCell align="right">股數</TableCell>
                      <TableCell align="right">可賣</TableCell>
                      <TableCell align="right">平均成本</TableCell>
                      <TableCell align="right">現價</TableCell>
                      <TableCell align="right">市值</TableCell>
                      <TableCell align="right">損益</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {w.holdings.map((h) => {
                      const value = h.stock.price * h.shares;
                      const pct = ((value - h.cost) / h.cost) * 100;
                      return (
                        <TableRow key={h.stock.code}>
                          <TableCell>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ alignItems: "center" }}
                            >
                              <ActressPhoto
                                alt={h.stock.name}
                                loading="lazy"
                                src={h.stock.photo}
                                sx={{
                                  borderRadius: 0.75,
                                  flexShrink: 0,
                                  width: 32,
                                }}
                              />
                              <Box sx={{ minWidth: 0 }}>
                                <Link
                                  component={RouterLink}
                                  sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
                                  to={stockActressPath(h.stock)}
                                  underline="hover"
                                >
                                  {h.stock.name}
                                </Link>
                                <Typography
                                  color="text.secondary"
                                  sx={{ fontSize: 12 }}
                                >
                                  {h.stock.code}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell align="right" sx={num}>
                            {h.shares.toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={num}>
                            {h.sellable.toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={num}>
                            {money(h.cost / h.shares)}
                          </TableCell>
                          <TableCell align="right" sx={num}>
                            {money(h.stock.price)}
                          </TableCell>
                          <TableCell align="right" sx={num}>
                            {money(value)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: changeColor(pct), ...num }}
                          >
                            {signedPct(pct)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Paper>

            {(trades.data?.total ?? 0) > 0 && (
              <Paper
                sx={{ overflowX: "auto", p: { xs: 1.5, md: 2 } }}
                variant="outlined"
              >
                <Typography component="h2" sx={titleSx}>
                  成交紀錄
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>時間</TableCell>
                      <TableCell>女優</TableCell>
                      <TableCell>買賣</TableCell>
                      <TableCell align="right">股數</TableCell>
                      <TableCell align="right">成交金額</TableCell>
                      <TableCell align="right">手續費</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {trades.data!.data.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ color: "text.secondary", ...num }}>
                          {dayjs(t.created_at).format("MM/DD HH:mm")}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <Link
                            component={RouterLink}
                            to={stockPath(t.code)}
                            underline="hover"
                          >
                            {t.name}
                          </Link>
                        </TableCell>
                        <TableCell
                          sx={{
                            color:
                              t.side === "buy" ? "error.main" : "success.main",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.side === "buy" ? "買進" : "賣出"}
                        </TableCell>
                        <TableCell align="right" sx={num}>
                          {t.shares.toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={num}>
                          {money(t.amount)}
                        </TableCell>
                        <TableCell align="right" sx={num}>
                          {money(t.fee)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {pageCount > 1 && (
                  <Pagination
                    count={pageCount}
                    onChange={(_, p) =>
                      setParams(p > 1 ? { page: String(p) } : {})
                    }
                    page={Math.min(page, pageCount)}
                    sx={{ display: "flex", justifyContent: "center", mt: 2 }}
                  />
                )}
              </Paper>
            )}
          </>
        )}
      </Stack>
      <ErrorSnack
        message="持股資料讀取失敗，請稍後再試"
        open={wallet.isError || trades.isError}
      />
    </AgeConfirmationGate>
  );
}
