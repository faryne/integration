import { Link as RouterLink, useParams } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Chip,
  Link,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

import { stockChangePct, useMarketStock } from "@/apis/av/joyu_market.ts";
import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { VideoCoverCard } from "@/components/av/video_cover_card.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { ErrorSnack } from "@/components/joyu/home/ErrorSnack.tsx";
import { StockChange } from "@/components/joyu/market/StockChange.tsx";
import { StockChart } from "@/components/joyu/market/StockChart.tsx";
import {
  RecentTradesCard,
  StockHoldingCard,
} from "@/components/joyu/market/StockSideCards.tsx";
import { TradePanel } from "@/components/joyu/market/TradePanel.tsx";
import { actressPagePath, actressRefOf } from "@/helpers/avActressRef.ts";
import { useBreadcrumbTail } from "@/helpers/breadcrumbTail.ts";
import { joyuPath } from "@/helpers/joyu.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

// 單日漲跌幅限制（跟後端一樣 ±20%），顯示漲停／跌停價
const PRICE_LIMIT = 0.2;
const RECENT_VIDEOS = 6;
const num = { fontVariantNumeric: "tabular-nums" } as const;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ bgcolor: "action.hover", borderRadius: 1.5, px: 1.25, py: 1 }}>
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 16, fontWeight: 700, ...num }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * joyu 女優股市個股頁（/market/J0001）：報價（現價、昨收、漲跌停價、近 90 天出片、流通股數、今日成交量、上市日）、
 * 基本價、走勢圖、交易面板、我在這檔的持股、最近成交、她最近的作品
 */
export function JoyuStockDetail() {
  const { code } = useParams();
  const stock = useMarketStock(code);
  const s = stock.data;
  useTitle(s ? `${s.name}（${s.code}）女優股市` : "女優股市");
  useBreadcrumbTail(s ? `${s.code} ${s.name}` : code);
  const videos = useAVVideoSearch(
    s ? { page: 1, actress: [s.name], ...actressRefOf(s) } : { page: 1 },
    !!s,
  );

  if (axios.isAxiosError(stock.error) && stock.error.response?.status === 404) {
    return <ErrorPage backUrl={joyuPath("market")} code={404} />;
  }

  return (
    <AgeConfirmationGate
      description="joyu.fyi 包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      panelTitle="joyu.fyi 需要年齡確認"
    >
      {/* 桌機：左欄報價＋近期作品、右欄交易相關；手機：報價 → 交易相關 → 近期作品（不用捲過作品才找得到交易） */}
      <Box
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 2,
          gridTemplateAreas: {
            xs: '"quote" "side" "chart" "videos"',
            md: '"quote side" "chart side" "videos side"',
          },
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "minmax(0, 1fr) 320px",
          },
          // 右欄比報價卡高時，多出來的高度給第二列，報價卡和作品之間才不會空一大段
          gridTemplateRows: { md: "auto auto 1fr" },
          textAlign: "left",
        }}
      >
        <Paper
          sx={{ gridArea: "quote", p: { xs: 1.5, md: 2 } }}
          variant="outlined"
        >
          {!s ? (
            <Skeleton height={140} variant="rounded" />
          ) : (
            <>
              <Stack direction="row" spacing={2}>
                <ActressPhoto
                  alt={s.name}
                  src={s.photo}
                  sx={{
                    borderRadius: 1.5,
                    flexShrink: 0,
                    width: { xs: 72, md: 90 },
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <Typography
                      component="h1"
                      noWrap
                      sx={{ fontSize: 21, fontWeight: 800 }}
                    >
                      {s.name}
                    </Typography>
                    <Typography color="text.secondary" sx={num}>
                      {s.code}
                    </Typography>
                    {s.status === "delisted" && (
                      <Chip label="已下市" size="small" />
                    )}
                  </Stack>
                  <Link
                    component={RouterLink}
                    sx={{ fontSize: 13 }}
                    to={actressPagePath(s.name, s)}
                    underline="hover"
                  >
                    女優頁 →
                  </Link>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "baseline", mt: 0.5 }}
                  >
                    <Typography
                      sx={{
                        fontSize: 32,
                        fontWeight: 800,
                        lineHeight: 1.2,
                        ...num,
                      }}
                    >
                      {s.price.toFixed(2)}
                    </Typography>
                    <StockChange
                      pct={stockChangePct(s)}
                      sx={{ fontSize: 16 }}
                    />
                  </Stack>
                  <Typography
                    color="text.secondary"
                    sx={{ fontSize: 12, ...num }}
                  >
                    昨收 {s.prev_close.toFixed(2)}・漲停{" "}
                    {(s.prev_close * (1 + PRICE_LIMIT)).toFixed(2)}・跌停{" "}
                    {(s.prev_close * (1 - PRICE_LIMIT)).toFixed(2)}
                  </Typography>
                </Box>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(5, minmax(0, 1fr))",
                  },
                  mt: 1.5,
                }}
              >
                <Stat label="基本價" value={s.fundamental.toFixed(2)} />
                <Stat label="近 90 天出片" value={`${s.videos_90d} 部`} />
                <Stat
                  label="流通／上限"
                  value={`${s.shares_out.toLocaleString()} / ${s.share_cap.toLocaleString()}`}
                />
                <Stat label="今日成交量" value={s.volume.toLocaleString()} />
                <Stat label="上市日" value={s.listed_at.slice(0, 10)} />
              </Box>
            </>
          )}
        </Paper>

        {s && (
          <Box sx={{ gridArea: "chart", minWidth: 0 }}>
            <StockChart stock={s} />
          </Box>
        )}

        {s && (
          <Stack spacing={2} sx={{ gridArea: "side", minWidth: 0 }}>
            <TradePanel stock={s} />
            <StockHoldingCard code={s.code} />
            <RecentTradesCard stock={s} />
          </Stack>
        )}

        {(videos.data?.data.data.length ?? 0) > 0 && (
          <Paper
            sx={{ gridArea: "videos", p: { xs: 1.5, md: 2 } }}
            variant="outlined"
          >
            <Typography
              component="h2"
              sx={{ fontSize: 17, fontWeight: 800, mb: 1.5 }}
            >
              近期作品
            </Typography>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "repeat(3, minmax(0, 1fr))",
                  md: "repeat(6, minmax(0, 1fr))",
                },
              }}
            >
              {videos.data!.data.data.slice(0, RECENT_VIDEOS).map((v) => (
                <VideoCoverCard key={v.no} video={v} />
              ))}
            </Box>
          </Paper>
        )}
      </Box>
      <ErrorSnack
        message="股市資料讀取失敗，請稍後再試"
        open={stock.isError || videos.isError}
      />
    </AgeConfirmationGate>
  );
}
