import {
  Box,
  Chip,
  Pagination,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import type { UseQueryResult } from "@tanstack/react-query";

import type { VideoFacetBucket } from "@/apis/av/video_facets.ts";
import type { VideoSearchResponse } from "@/apis/av/video_search.ts";
import {
  VideoResultCard,
  VideoResultSkeleton,
} from "@/components/av/video_result_card.tsx";
import { SITE_HEADER_HEIGHT } from "@/components/common/siteLayout/siteTheme.ts";
import { AV_VIDEO_GRID_COLUMNS } from "@/data/avVideoCover.ts";
import type { Video } from "@/types/av.ts";

/** 出演影片的 tab：topic＝從有類型條件的主題點進來時的「該主題作品」、all＝全部作品 */
export type ActressVideoTab = "topic" | "all";

/** 作品篩選：年份、發售商、標籤各選一個（再點一次取消），存在女優頁網址的 ?year=／?maker=／?tag= */
export interface ActressWorksFilter {
  year?: string;
  maker?: string;
  tag?: string;
}

// 依配信日的年份分組，順序維持 API 回傳的新到舊；配信日缺漏的歸到「年份不明」
const groupByYear = (videos: Video[]) => {
  const groups = new Map<string, Video[]>();
  videos.forEach((v) => {
    const year = v.vod_date?.slice(0, 4) || "年份不明";
    groups.set(year, [...(groups.get(year) ?? []), v]);
  });
  return [...groups.entries()];
};

function FilterChips({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: VideoFacetBucket[];
  selected?: string;
  onSelect: (value?: string) => void;
}) {
  if (!items.length) return null;
  return (
    <Stack
      direction="row"
      gap={0.75}
      sx={{ alignItems: "center", flexWrap: "wrap" }}
      useFlexGap
    >
      <Typography color="text.secondary" sx={{ fontSize: 12, mr: 0.5 }}>
        {label}
      </Typography>
      {items.map((b) => (
        <Chip
          key={b.value}
          clickable
          color={selected === b.value ? "primary" : "default"}
          // 年份不顯示部數（count 給 0），見規格「不顯示各年部數」
          label={b.count ? `${b.value} ${b.count}` : b.value}
          onClick={() => onSelect(selected === b.value ? undefined : b.value)}
          size="small"
          variant={selected === b.value ? "filled" : "outlined"}
        />
      ))}
    </Stack>
  );
}

/**
 * 女優頁「出演作品」（P2）：上方篩選列（年份：出道年到最新一年；發售商、標籤：facets，涵蓋全部作品不只這一頁），
 * 作品依配信年份分組（年份從這一頁的影片分出來，不另外查各年部數），年份標題捲動時固定在頁首下方，下方分頁
 */
export function ActressWorks({
  videos,
  page,
  onPageChange,
  years,
  makers,
  tags,
  filter,
  onFilterChange,
  pageName,
  realName,
  videoTabs,
}: {
  videos?: UseQueryResult<VideoSearchResponse, Error>;
  page: number;
  onPageChange: (page: number) => void;
  // 有作品的年份（新到舊），從 summary 的最早／最新配信日推算
  years: string[];
  makers: VideoFacetBucket[];
  tags: VideoFacetBucket[];
  filter: ActressWorksFilter;
  onFilterChange: (filter: ActressWorksFilter) => void;
  pageName: string;
  realName: string;
  videoTabs?: {
    label: string;
    value: ActressVideoTab;
    onChange: (tab: ActressVideoTab) => void;
  };
}) {
  const data = videos?.data?.data;
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageCount = data?.per_page ? Math.ceil(total / data.per_page) : 0;

  return (
    <Box component="section" sx={{ textAlign: "left" }}>
      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 800 }}>
        出演作品
        <Box
          component="span"
          sx={{ color: "text.secondary", fontSize: 13, fontWeight: 400, ml: 1 }}
        >
          {videos?.isSuccess
            ? `${pageName !== realName ? `${pageName} 名義・` : ""}${total.toLocaleString()} 部`
            : "讀取中"}
        </Box>
      </Typography>

      {videoTabs && (
        <Tabs
          onChange={(_, v: ActressVideoTab) => videoTabs.onChange(v)}
          sx={{ borderBottom: 1, borderColor: "divider", mt: 1 }}
          value={videoTabs.value}
        >
          <Tab label={`${videoTabs.label}作品`} value="topic" />
          <Tab label="全部作品" value="all" />
        </Tabs>
      )}

      <Stack spacing={1} sx={{ my: 2 }}>
        <FilterChips
          label="年份"
          items={years.map((value) => ({ value, count: 0 }))}
          selected={filter.year}
          onSelect={(year) => onFilterChange({ ...filter, year })}
        />
        <FilterChips
          label="發售商"
          items={makers}
          selected={filter.maker}
          onSelect={(maker) => onFilterChange({ ...filter, maker })}
        />
        <FilterChips
          label="標籤"
          items={tags}
          selected={filter.tag}
          onSelect={(tag) => onFilterChange({ ...filter, tag })}
        />
      </Stack>

      {videos?.isPending && (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: AV_VIDEO_GRID_COLUMNS,
          }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <VideoResultSkeleton key={i} />
          ))}
        </Box>
      )}

      {videos?.isSuccess && rows.length === 0 && (
        <Box
          sx={{
            alignItems: "center",
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 2,
            color: "text.secondary",
            display: "flex",
            flexDirection: "column",
            gap: 1,
            justifyContent: "center",
            minHeight: 220,
          }}
        >
          <SearchOffIcon fontSize="large" />
          <Typography fontWeight={800}>沒有出演影片</Typography>
        </Box>
      )}

      {groupByYear(rows).map(([year, items]) => (
        <Box key={year}>
          {/* 年份標題捲動時固定在頁首下方，隨時看得到正在看哪一年 */}
          <Stack
            direction="row"
            sx={{
              alignItems: "baseline",
              bgcolor: "background.default",
              gap: 1,
              mb: 1.25,
              mt: 2.5,
              position: "sticky",
              py: 0.75,
              top: SITE_HEADER_HEIGHT,
              zIndex: 1,
              "&::after": {
                content: '""',
                flex: 1,
                borderBottom: "1px dashed",
                borderColor: "divider",
              },
            }}
          >
            <Typography sx={{ fontSize: 18, fontWeight: 800 }}>
              {year}
            </Typography>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: AV_VIDEO_GRID_COLUMNS,
            }}
          >
            {items.map((video) => (
              <VideoResultCard key={video.no} video={video} />
            ))}
          </Box>
        </Box>
      ))}

      {pageCount > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 3 }}>
          <Pagination
            count={pageCount}
            onChange={(_, p) => onPageChange(p)}
            page={data?.current_page ?? page}
            shape="rounded"
            variant="outlined"
          />
        </Box>
      )}
    </Box>
  );
}
