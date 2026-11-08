import { Chip, Stack } from "@mui/material";
import type { VideoSearchRequest } from "@/apis/av/video_search.ts";
import type { ListByPaginationRequest } from "@/apis/interfaces";
import { AV_VIDEO_EXACT_FILTERS } from "@/data/avVideoFilters.ts";
import { SearchFollowButton } from "@/components/joyu/SearchFollowButton.tsx";

type Search = ListByPaginationRequest<VideoSearchRequest>;

/** 目前有沒有任何搜尋條件（排序不算） */
const hasVideoSearchCondition = (s: Search) =>
  Boolean(
    s.keyword ||
    s.start_date ||
    s.end_date ||
    s.duration_min ||
    s.duration_max ||
    AV_VIDEO_EXACT_FILTERS.some(({ param }) => s[param]?.length),
  );

const durationLabel = (min?: number, max?: number) =>
  min && max ? `${min}～${max} 分` : min ? `${min} 分以上` : `${max} 分以下`;

/**
 * 影片搜尋結果上方的條件列：一個值一個 chip，全部都能移除（移除後回到第一頁）；
 * 最前面是「追蹤這個搜尋」（joyu 我的追蹤頁會列出這組條件最近的新片）
 */
export function VideoSearchChips({
  search,
  onChange,
}: {
  search: Search;
  onChange: (next: Search) => void;
}) {
  if (!hasVideoSearchCondition(search)) return null;
  const drop = (patch: Partial<Search>) =>
    onChange({ ...search, ...patch, page: 1 });
  const chip = (
    key: string,
    label: string,
    onDelete: () => void,
    outlined = false,
  ) => (
    <Chip
      key={key}
      label={label}
      onDelete={onDelete}
      size="small"
      sx={{ borderRadius: 1 }}
      variant={outlined ? "outlined" : "filled"}
    />
  );

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      gap={1}
      sx={{ alignItems: "center" }}
    >
      <SearchFollowButton search={search} />
      {search.keyword &&
        chip("keyword", `關鍵字：${search.keyword}`, () =>
          drop({ keyword: undefined }),
        )}
      {AV_VIDEO_EXACT_FILTERS.flatMap(({ param, label }) =>
        (search[param] ?? []).map((v) =>
          chip(`${param}-${v}`, `${label}：${v}`, () =>
            drop({ [param]: search[param]!.filter((x) => x !== v) }),
          ),
        ),
      )}
      {(search.duration_min || search.duration_max) &&
        chip(
          "duration",
          `片長：${durationLabel(search.duration_min, search.duration_max)}`,
          () => drop({ duration_min: undefined, duration_max: undefined }),
          true,
        )}
      {search.start_date &&
        chip(
          "start",
          `開始：${search.start_date}`,
          () => drop({ start_date: undefined }),
          true,
        )}
      {search.end_date &&
        chip(
          "end",
          `結束：${search.end_date}`,
          () => drop({ end_date: undefined }),
          true,
        )}
    </Stack>
  );
}
