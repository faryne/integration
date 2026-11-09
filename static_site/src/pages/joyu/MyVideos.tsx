import { useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Pagination,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  useJoyuMarks,
  useMarkedVideos,
  useSetMark,
  type MarkedVideosParams,
  type MarkStatus,
} from "@/apis/av/joyu_marks.ts";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { VideoResultCard } from "@/components/av/video_result_card.tsx";
import { useJoyuAuth } from "@/components/joyu/auth/JoyuAuthContext.ts";
import { AV_VIDEO_GRID_COLUMNS } from "@/data/avVideoCover.ts";
import { joyuPath } from "@/helpers/joyu.ts";
import { useTitle } from "@/helpers/title.tsx";

const STATUS_LABELS: Record<MarkStatus, string> = {
  want: "想看",
  watched: "看過",
};
// 看過的評分篩選（網址 ?rating=）
const RATING_FILTERS: { value: MarkedVideosParams["rating"]; label: string }[] =
  [
    { value: undefined, label: "全部" },
    { value: "5", label: "★5" },
    { value: "4", label: "★4" },
    { value: "le3", label: "★3 以下" },
    { value: "none", label: "未評分" },
  ];

/**
 * joyu 我的片單（/me/videos）：想看／看過分頁，看過可依評分篩選，排序可選加入時間或配信日。
 * 條件都存在網址（?status=watched&rating=5&sort=date&page=2）；影片已經不在索引裡的只顯示番號，可以直接移除
 */
export function JoyuMyVideos() {
  useTitle("我的片單");
  const { user, loading } = useJoyuAuth();
  const [params, setParams] = useSearchParams();
  const status: MarkStatus =
    params.get("status") === "watched" ? "watched" : "want";
  const rating = RATING_FILTERS.find(
    (r) => r.value === params.get("rating"),
  )?.value;
  const sort = params.get("sort") === "date" ? "date" : undefined;
  const page = Math.max(Number(params.get("page")) || 1, 1);

  const marks = useJoyuMarks(user?.uid);
  const list = useMarkedVideos(user?.uid, {
    status,
    rating: status === "watched" ? rating : undefined,
    sort,
    page,
  });
  const setMark = useSetMark();
  const [errorClosed, setErrorClosed] = useState(false);
  const counts = { want: 0, watched: 0 };
  for (const m of marks.data ?? []) counts[m.status]++;

  // 換條件時回到第一頁；換狀態時評分篩選一起清掉
  const update = (patch: Record<string, string | undefined>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!("page" in patch)) next.delete("page");
      return next;
    });

  const rows = list.data?.data ?? [];
  const pageCount = list.data?.last_page ?? 0;
  const empty = !loading && (!user || (marks.data && marks.data.length === 0));

  return (
    <AgeConfirmationGate
      description="joyu.fyi 包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      panelTitle="joyu.fyi 需要年齡確認"
    >
      <Stack spacing={3} sx={{ textAlign: "left" }}>
        <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800 }}>
          我的片單
        </Typography>

        {empty ? (
          <Stack
            spacing={2}
            sx={{
              alignItems: "center",
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 3,
              py: 5,
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>還沒有加入任何影片</Typography>
            <Button
              component={RouterLink}
              to={joyuPath("video")}
              variant="contained"
            >
              去找影片
            </Button>
          </Stack>
        ) : (
          <>
            <Stack
              direction="row"
              flexWrap="wrap"
              gap={1}
              sx={{ alignItems: "center" }}
              useFlexGap
            >
              {(["want", "watched"] as const).map((s) => (
                <Chip
                  key={s}
                  clickable
                  color={status === s ? "primary" : "default"}
                  label={`${STATUS_LABELS[s]} ${counts[s]}`}
                  onClick={() =>
                    update({
                      status: s === "want" ? undefined : s,
                      rating: undefined,
                    })
                  }
                  variant={status === s ? "filled" : "outlined"}
                />
              ))}
              {status === "watched" && (
                <>
                  <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />
                  {RATING_FILTERS.map((r) => (
                    <Chip
                      key={r.label}
                      clickable
                      color={rating === r.value ? "primary" : "default"}
                      label={r.label}
                      onClick={() => update({ rating: r.value })}
                      size="small"
                      variant={rating === r.value ? "filled" : "outlined"}
                    />
                  ))}
                </>
              )}
              <TextField
                onChange={(e) =>
                  update({
                    sort: e.target.value === "date" ? "date" : undefined,
                  })
                }
                select
                size="small"
                sx={{ ml: "auto" }}
                value={sort ?? "added"}
              >
                <MenuItem value="added">加入時間</MenuItem>
                <MenuItem value="date">配信日</MenuItem>
              </TextField>
            </Stack>

            {(loading || list.isPending) && (
              <Skeleton height={320} variant="rounded" />
            )}
            {list.isSuccess && rows.length === 0 && (
              <Typography color="text.secondary">沒有符合的影片</Typography>
            )}
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: AV_VIDEO_GRID_COLUMNS,
              }}
            >
              {rows.map(({ mark, video }) =>
                video ? (
                  <VideoResultCard key={mark.no} video={video} />
                ) : (
                  // 影片已經不在索引裡（下架）：只剩番號，留一顆移除
                  <Stack
                    key={mark.no}
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      border: "1px dashed",
                      borderColor: "divider",
                      borderRadius: 2,
                      justifyContent: "center",
                      minHeight: 200,
                      p: 2,
                    }}
                  >
                    <Typography sx={{ fontWeight: 700 }}>
                      {mark.no.toUpperCase()}
                    </Typography>
                    <Button
                      color="inherit"
                      onClick={() =>
                        user &&
                        setMark.mutate({
                          uid: user.uid,
                          no: mark.no,
                          mark: null,
                        })
                      }
                      size="small"
                    >
                      從片單移除
                    </Button>
                  </Stack>
                ),
              )}
            </Box>
            {pageCount > 1 && (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Pagination
                  count={pageCount}
                  onChange={(_, p) =>
                    update({ page: p > 1 ? String(p) : undefined })
                  }
                  page={page}
                  shape="rounded"
                  variant="outlined"
                />
              </Box>
            )}
          </>
        )}
      </Stack>
      <CustomSnackbar
        message={
          setMark.isError ? "移除失敗，請稍後再試" : "片單讀取失敗，請稍後再試"
        }
        onClose={() => {
          setMark.reset();
          setErrorClosed(true);
        }}
        open={setMark.isError || (list.isError && !errorClosed)}
        severity="error"
      />
    </AgeConfirmationGate>
  );
}
