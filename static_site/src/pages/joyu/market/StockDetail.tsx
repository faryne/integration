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
 * joyu 女優股市個股頁（/market/J0001）：報價（現價、昨收、漲跌停價、近 90 天出片、流通股數、上市日）與她最近的作品。
 * 交易面板、走勢圖在 P2／P3 加上
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
      <Stack spacing={2} sx={{ textAlign: "left" }}>
        <Paper sx={{ p: { xs: 1.5, md: 2 } }} variant="outlined">
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
                    md: "repeat(3, minmax(0, 1fr))",
                  },
                  mt: 1.5,
                }}
              >
                <Stat label="近 90 天出片" value={`${s.videos_90d} 部`} />
                <Stat label="流通股數" value={s.shares_out.toLocaleString()} />
                <Stat label="上市日" value={s.listed_at.slice(0, 10)} />
              </Box>
            </>
          )}
        </Paper>

        {(videos.data?.data.data.length ?? 0) > 0 && (
          <Paper sx={{ p: { xs: 1.5, md: 2 } }} variant="outlined">
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
      </Stack>
      <ErrorSnack
        message="股市資料讀取失敗，請稍後再試"
        open={stock.isError || videos.isError}
      />
    </AgeConfirmationGate>
  );
}
