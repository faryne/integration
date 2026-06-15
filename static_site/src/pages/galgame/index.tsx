import {
  Box,
  Button,
  Grid,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState, type FormEvent } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import { useGalgameVideos } from "@/apis/galgame/catalog.ts";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { GalgameVideoCard } from "@/components/galgame/GalgameVideoCard.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { useTitle } from "@/helpers/title.tsx";

export default function GalgameHome() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get("keyword") ?? "";
  const tab = params.get("tab") === "recent" ? "recent" : "all";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [draft, setDraft] = useState(keyword);
  const publishedAtFrom =
    tab === "recent"
      ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      : undefined;
  const videos = useGalgameVideos(undefined, {
    keyword,
    page,
    per_page: 24,
    published_at_from: publishedAtFrom,
  });
  useTitle("Galgame 影片");

  const pages = useMemo(
    () => Math.max(1, Math.ceil((videos.data?.total ?? 0) / (videos.data?.per_page || 24))),
    [videos.data],
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (tab === "recent") {
      next.set("tab", "recent");
    }
    if (draft.trim()) {
      next.set("keyword", draft.trim());
    }
    setParams(next);
  };

  return (
    <Box sx={{ pb: 6 }}>
      <GalgameBreadcrumb />
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Box>
            <Typography variant="h3" component="h1">Galgame 最新影片</Typography>
            <Typography color="text.secondary">各遊戲品牌官方頻道的最新 PV、OP 與相關影片。</Typography>
          </Box>
          <Button component={RouterLink} to="/galgame/brands" variant="outlined">
            品牌列表
          </Button>
        </Stack>
        <Stack component="form" direction="row" spacing={1} onSubmit={submit}>
          <TextField fullWidth label="搜尋影片" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button type="submit" variant="contained">搜尋</Button>
        </Stack>
        <Tabs
          value={tab}
          onChange={(_, value: "all" | "recent") => {
            const next = new URLSearchParams(params);
            value === "recent" ? next.set("tab", "recent") : next.delete("tab");
            next.delete("page");
            setParams(next);
          }}
          aria-label="影片時間範圍"
        >
          <Tab value="all" label="所有影片" />
          <Tab value="recent" label="最近一天內上檔影片" />
        </Tabs>
        {videos.isPending ? (
          <GalgameState loading message="正在載入影片..." />
        ) : videos.isError ? (
          <GalgameState severity="error" message="影片載入失敗，請稍後再試。" />
        ) : videos.data.data.length === 0 ? (
          <GalgameState message={keyword ? "找不到符合搜尋條件的影片。" : "目前尚無影片資料。"} />
        ) : (
          <>
            <Grid container spacing={3}>
              {videos.data.data.map((video) => (
                <Grid key={video.youtube_video_id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <GalgameVideoCard video={video} />
                </Grid>
              ))}
            </Grid>
            <Pagination
              page={page}
              count={pages}
              onChange={(_, value) => {
                const next = new URLSearchParams(params);
                value === 1 ? next.delete("page") : next.set("page", String(value));
                setParams(next);
              }}
              sx={{ alignSelf: "center" }}
            />
          </>
        )}
      </Stack>
    </Box>
  );
}
