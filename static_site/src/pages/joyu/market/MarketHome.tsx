import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Chip,
  InputBase,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

import { useMarketStocks } from "@/apis/av/joyu_market.ts";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { ErrorSnack } from "@/components/joyu/home/ErrorSnack.tsx";
import { StockList } from "@/components/joyu/market/StockList.tsx";
import { useTitle } from "@/helpers/title.tsx";

const PAGE_SIZE = 50;

// 排序：P1 還不能交易、價格都是 IPO 價，先只放近期出片與代碼；開放交易後再加漲幅、跌幅、成交量
const SORTS = [
  { key: "recent", label: "近期出片" },
  { key: "code", label: "代碼" },
] as const;

/**
 * joyu 女優股市總覽（/market）：上市中的全部女優股，可依近期出片或代碼排序、用名字或代碼篩選。
 * 條件存在網址（?sort=code&q=波多&page=2），從個股頁返回時還在原處
 */
export function JoyuMarketHome() {
  useTitle("女優股市");
  const [params, setParams] = useSearchParams();
  const sort = params.get("sort") === "code" ? "code" : "recent";
  const q = params.get("q") ?? "";
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const update = (patch: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: "q" in patch },
    );

  const stocks = useMarketStocks();
  const rows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    const list = (stocks.data ?? []).filter(
      (s) =>
        !keyword ||
        s.name.toLowerCase().includes(keyword) ||
        s.code.toLowerCase().includes(keyword),
    );
    return sort === "code"
      ? list
      : [...list].sort((a, b) => b.videos_90d - a.videos_90d);
  }, [stocks.data, q, sort]);
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);

  return (
    <AgeConfirmationGate
      description="joyu.fyi 包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      panelTitle="joyu.fyi 需要年齡確認"
    >
      <Stack spacing={2} sx={{ textAlign: "left" }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline" }}>
          <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800 }}>
            女優股市
          </Typography>
          {stocks.data && (
            <Typography color="text.secondary" sx={{ fontSize: 14 }}>
              上市 {stocks.data.length} 檔
            </Typography>
          )}
        </Stack>
        <Paper sx={{ p: { xs: 1.5, md: 2 } }} variant="outlined">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            gap={1}
            sx={{ alignItems: { sm: "center" }, mb: 1 }}
          >
            <Stack direction="row" gap={0.75}>
              {SORTS.map((s) => (
                <Chip
                  clickable
                  color={sort === s.key ? "primary" : "default"}
                  key={s.key}
                  label={s.label}
                  onClick={() =>
                    update({ sort: s.key === "recent" ? undefined : s.key })
                  }
                  variant={sort === s.key ? "filled" : "outlined"}
                />
              ))}
            </Stack>
            <InputBase
              inputProps={{ "aria-label": "篩選名字或代碼" }}
              onChange={(e) => update({ q: e.target.value || undefined })}
              placeholder="名字或代碼"
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                fontSize: 14,
                ml: { sm: "auto" },
                px: 1.25,
                py: 0.25,
                width: { xs: "100%", sm: 220 },
              }}
              value={q}
            />
          </Stack>
          {stocks.isPending ? (
            <Stack spacing={1}>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton height={52} key={i} variant="rounded" />
              ))}
            </Stack>
          ) : (
            <StockList
              stocks={rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
            />
          )}
          {pageCount > 1 && (
            <Pagination
              count={pageCount}
              onChange={(_, p) =>
                update({ page: p > 1 ? String(p) : undefined })
              }
              page={Math.min(page, pageCount)}
              sx={{ display: "flex", justifyContent: "center", mt: 2 }}
            />
          )}
        </Paper>
      </Stack>
      <ErrorSnack
        message="股市資料讀取失敗，請稍後再試"
        open={stocks.isError}
      />
    </AgeConfirmationGate>
  );
}
