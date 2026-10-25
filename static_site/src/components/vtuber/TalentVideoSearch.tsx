import {
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";

import { useVtuberVideoSearch } from "@/apis/opendata/vtubers.ts";
import { VideoCard } from "@/components/vtuber/VideoCard.tsx";
import { videoGridSx } from "@/components/vtuber/videoGrid.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import type { VtuberVideo, VtuberVideoSearchOrder } from "@/types/vtubers.ts";

const ORDERS: [VtuberVideoSearchOrder, string][] = [
  ["relevance", "相關性"],
  ["date", "最新"],
];
// 後端「YouTube 搜尋額度用完」的自訂代碼（跟 IP 超過上限的 429 分開；503001 是全站維護，會被攔截器切到維護頁）
const QUOTA_EXHAUSTED_CODE = "503002";

export interface VideoSearchQuery {
  q: string;
  order: VtuberVideoSearchOrder;
}

interface VideoSearchFormProps {
  available: boolean; // YouTube 搜尋額度用完時 false：輸入框、排序、按鈕都停用
  onSearch: (query: VideoSearchQuery) => void;
}

/** 影片搜尋列：按 Enter 或「搜尋」才查（每查一頁都花 YouTube 額度，不邊打字邊查） */
export function VideoSearchForm({ available, onSearch }: VideoSearchFormProps) {
  const [input, setInput] = useState("");
  const [order, setOrder] = useState<VtuberVideoSearchOrder>("relevance");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (available && q) onSearch({ q, order });
  };
  return (
    <Stack
      component={"form"}
      onSubmit={submit}
      direction={"row"}
      spacing={1}
      useFlexGap
      flexWrap={"wrap"}
      sx={{ mb: 1.75 }}
    >
      <TextField
        size={"small"}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={!available}
        placeholder={
          available ? "搜尋這位藝人的影片" : "今日影片搜尋額度已用完"
        }
        sx={{ flex: "1 1 220px" }}
        slotProps={{
          htmlInput: { maxLength: 100 },
          input: {
            startAdornment: (
              <InputAdornment position={"start"}>
                <SearchIcon fontSize={"small"} />
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField
        select
        size={"small"}
        value={order}
        onChange={(e) => setOrder(e.target.value as VtuberVideoSearchOrder)}
        disabled={!available}
        sx={{ minWidth: 100 }}
      >
        {ORDERS.map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      <Button
        type={"submit"}
        variant={"contained"}
        disabled={!available || !input.trim()}
      >
        搜尋
      </Button>
    </Stack>
  );
}

interface VideoSearchResultsProps {
  handle: string;
  query: VideoSearchQuery;
  onPlay: (video: VtuberVideo) => void;
  onClear: () => void;
  onQuotaExhausted: () => void;
  onError: (error: unknown) => void;
}

/**
 * 影片搜尋結果：卡片跟「所有影片」同一種；「載入更多」要手動按（每頁都花額度）。
 * IP 超過每小時上限（429）、額度用完（503）用 ErrorPage 顯示，其他錯誤跳 snack
 */
export function VideoSearchResults({
  handle,
  query,
  onPlay,
  onClear,
  onQuotaExhausted,
  onError,
}: VideoSearchResultsProps) {
  const search = useVtuberVideoSearch(handle, query.q, query.order);
  const { error } = search;
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const quotaExhausted =
    status === 503 &&
    axios.isAxiosError(error) &&
    (error.response?.data as { custom_code?: string } | undefined)
      ?.custom_code === QUOTA_EXHAUSTED_CODE;

  useEffect(() => {
    if (quotaExhausted) onQuotaExhausted();
    else if (error && status !== 429) onError(error);
  }, [error, status, quotaExhausted, onQuotaExhausted, onError]);

  const videos = search.data?.pages.flatMap((p) => p.videos) ?? [];
  const orderLabel = ORDERS.find(([value]) => value === query.order)?.[1];
  return (
    <>
      <Stack direction={"row"} alignItems={"center"} sx={{ mb: 1.25 }}>
        <Typography variant={"body2"} color={"text.secondary"} noWrap>
          「{query.q}」・{orderLabel}
        </Typography>
        <Button size={"small"} onClick={onClear} sx={{ ml: "auto" }}>
          清除搜尋
        </Button>
      </Stack>

      {status === 429 ? (
        <ErrorPage
          compact
          code={429}
          message={apiErrorMessage(error, "影片搜尋太頻繁了，請稍後再試")}
        />
      ) : quotaExhausted ? (
        <ErrorPage
          compact
          code={503}
          title={"今天的影片搜尋額度用完了"}
          message={
            "喵嗚，影片搜尋今天的 YouTube 額度已經用完，明天就能再搜尋了。之前查過的結果和所有影片列表還是看得到喵。"
          }
        />
      ) : search.isSuccess && videos.length === 0 ? (
        <Paper variant={"outlined"} sx={{ p: 4, textAlign: "center" }}>
          <Typography color={"text.secondary"}>沒有符合的影片</Typography>
        </Paper>
      ) : (
        <Box sx={videoGridSx(false)}>
          {videos.map((video) => (
            <VideoCard
              key={video.video_id}
              video={video}
              keyword={query.q}
              onClick={() => onPlay(video)}
            />
          ))}
        </Box>
      )}
      <Box sx={{ py: 2, textAlign: "center" }}>
        {search.isLoading || search.isFetchingNextPage ? (
          <CircularProgress size={24} />
        ) : (
          search.hasNextPage &&
          !error && (
            <Button
              variant={"outlined"}
              onClick={() => void search.fetchNextPage()}
            >
              載入更多
            </Button>
          )
        )}
      </Box>
    </>
  );
}
