import {
  Alert,
  Box,
  Button,
  Grid,
  Pagination,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState, type FormEvent } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import { useGalgameVideos } from "@/apis/galgame/catalog.ts";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { GalgameVideoCard } from "@/components/galgame/GalgameVideoCard.tsx";
import { useTitle } from "@/helpers/title.tsx";

export default function GalgameHome() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get("keyword") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [draft, setDraft] = useState(keyword);
  const videos = useGalgameVideos(undefined, { keyword, page, per_page: 24 });
  useTitle("Galgame 影片");

  const pages = useMemo(
    () => Math.max(1, Math.ceil((videos.data?.total ?? 0) / (videos.data?.per_page || 24))),
    [videos.data],
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setParams(draft.trim() ? { keyword: draft.trim() } : {});
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
        {videos.isError && <Alert severity="error">影片載入失敗。</Alert>}
        <Grid container spacing={3}>
          {videos.data?.data.map((video) => (
            <Grid key={video.youtube_video_id} size={{ xs: 12, sm: 6, md: 4 }}>
              <GalgameVideoCard video={video} />
            </Grid>
          ))}
        </Grid>
        {videos.data?.data.length === 0 && <Alert severity="info">找不到符合條件的影片。</Alert>}
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
      </Stack>
    </Box>
  );
}
