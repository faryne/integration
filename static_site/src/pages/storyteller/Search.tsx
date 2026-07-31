import SearchIcon from "@mui/icons-material/Search";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import {
  Box,
  Button,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
  MenuItem,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStorytellerSearch } from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerWorkCard } from "@/pages/storyteller/StorytellerWorkCard.tsx";

const ratingOptions: { value: string; label: string }[] = [
  { value: "", label: "所有分級" },
  { value: "general", label: "普通級" },
  { value: "guidance", label: "輔導級" },
  { value: "restricted", label: "限制級" },
];

export default function StorytellerSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get("keyword") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const rating = searchParams.get("rating") ?? "";
  const [keywordInput, setKeywordInput] = useState(keyword);

  // 這個頁面在同一個 route 上只靠 query string 換頁時不會重新 mount（例如從 header
  // 的展開式搜尋框再送出一次），keywordInput 是 controlled input 自己的狀態，不會
  // 因為 URL 的 keyword 變了就自動同步，這裡補上，不然畫面上的輸入框會停留在舊字，
  // 跟實際套用的關鍵字（下面查詢用的 keyword）對不起來。
  useEffect(() => {
    setKeywordInput(keyword);
  }, [keyword]);

  useTitle(`全站作品搜尋 - ${STORYTELLER_APP_NAME}`, {
    path: steamloomPath("search"),
    robots: "noindex, nofollow",
  });

  const search = useStorytellerSearch({ keyword, tag, rating });
  const results = search.data?.pages.flatMap((page) => page.data) ?? [];
  const total = search.data?.pages[0]?.total ?? 0;

  function applyFilters(next: { keyword?: string; tag?: string; rating?: string }) {
    const params = new URLSearchParams(searchParams);
    const merged = { keyword, tag, rating, ...next };
    (["keyword", "tag", "rating"] as const).forEach((key) => {
      if (merged[key]) {
        params.set(key, merged[key]!);
      } else {
        params.delete(key);
      }
    });
    setSearchParams(params);
  }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          position: "relative",
          p: 3,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          "&::before": {
            content: '""',
            position: "absolute",
            insetInline: 0,
            top: 0,
            height: 3,
            borderRadius: "3px 3px 0 0",
            background: (theme) =>
              `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          },
        }}
      >
        <Typography variant="h5" fontWeight={800} gutterBottom>
          全站作品搜尋
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          在所有公開專案的文字故事與圖像作品裡找——標題、簡介、內文、圖片說明都算。
        </Typography>
        <Stack
          component="form"
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters({ keyword: keywordInput });
          }}
        >
          <TextField
            fullWidth
            placeholder="輸入關鍵字，例如「共鳴」「駕駛艙」……"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
                ),
              },
            }}
          />
          <TextField
            select
            sx={{ minWidth: { sm: 160 } }}
            label="分級"
            value={rating}
            onChange={(event) => applyFilters({ rating: event.target.value })}
          >
            {ratingOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant="contained" sx={{ whiteSpace: "nowrap" }}>
            搜尋
          </Button>
        </Stack>
        {tag && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Chip
              label={`標籤：${tag}`}
              onDelete={() => applyFilters({ tag: "" })}
            />
          </Stack>
        )}
      </Box>

      {!search.isLoading && (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
          color="text.secondary"
        >
          <Typography variant="body2">共找到 {total} 筆結果</Typography>
        </Stack>
      )}

      {search.isLoading ? (
        <StorytellerLoading label="正在搜尋..." />
      ) : results.length === 0 ? (
        <CustomEmptyState
          icon={<LockOpenIcon fontSize="large" />}
          title="沒有符合的作品"
          description="換個關鍵字，或是拿掉一些篩選條件試試。"
        />
      ) : (
        <>
          <Grid container spacing={2}>
            {results.map((result) => (
              <Grid key={result.story_public_id} size={{ xs: 12, sm: 6, md: 4 }}>
                <StorytellerWorkCard
                  result={result}
                  onTagClick={(nextTag) => applyFilters({ tag: nextTag })}
                />
              </Grid>
            ))}
          </Grid>
          {search.hasNextPage && (
            <Stack alignItems="center">
              <Button
                variant="outlined"
                disabled={search.isFetchingNextPage}
                onClick={() => void search.fetchNextPage()}
              >
                {search.isFetchingNextPage ? "載入中..." : "載入更多結果"}
              </Button>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
