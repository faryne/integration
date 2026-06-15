import {
  Avatar,
  Box,
  Button,
  Chip,
  Grid,
  Pagination,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { useGalgameBrands, useGalgameVideos } from "@/apis/galgame/catalog.ts";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { GalgameVideoCard } from "@/components/galgame/GalgameVideoCard.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { useTitle } from "@/helpers/title.tsx";

export default function GalgameBrand() {
  const { brandSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const brands = useGalgameBrands();
  const publicId = brandSlug?.split("-", 1)[0];
  const brand = brands.data?.data.find((item) => item.public_id === publicId);
  const videos = useGalgameVideos(brandSlug, { page, per_page: 24 });
  const pages = useMemo(
    () => Math.max(1, Math.ceil((videos.data?.total ?? 0) / (videos.data?.per_page || 24))),
    [videos.data],
  );
  useTitle(brand ? `${brand.name} 影片` : "品牌影片");

  return (
    <Box sx={{ pb: 6 }}>
      <GalgameBreadcrumb brand={brand} />
      <Stack spacing={3}>
        {brands.isPending ? (
          <GalgameState loading message="正在載入品牌資料..." />
        ) : brands.isError ? (
          <GalgameState severity="error" message="品牌資料載入失敗，請稍後再試。" />
        ) : !brand ? (
          <GalgameState severity="error" message="找不到此品牌。" />
        ) : (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={3}
              alignItems={{ xs: "center", md: "flex-start" }}
            >
              <Avatar
                src={brand.avatar_url}
                alt={brand.name}
                sx={{ width: 144, height: 144, flexShrink: 0 }}
              />
              <Stack spacing={2} sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h3" component="h1">
                  {brand.name}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {brand.subscriber_count > 0 && (
                    <Chip label={`${brand.subscriber_count.toLocaleString()} 位訂閱者`} />
                  )}
                  {brand.video_count > 0 && (
                    <Chip label={`${brand.video_count.toLocaleString()} 部 YouTube 影片`} />
                  )}
                  {brand.view_count > 0 && (
                    <Chip label={`${brand.view_count.toLocaleString()} 次觀看`} />
                  )}
                </Stack>
                {brand.description && (
                  <Typography sx={{ whiteSpace: "pre-wrap" }}>
                    {brand.description}
                  </Typography>
                )}
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {brand.links.map((link) => (
                    <Button
                      key={link.url}
                      component="a"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outlined"
                      size="small"
                      endIcon={<OpenInNewIcon />}
                    >
                      {link.label}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        )}
        {brand && (
          videos.isPending ? (
            <GalgameState loading message="正在載入品牌影片..." />
          ) : videos.isError ? (
            <GalgameState severity="error" message="影片載入失敗，請稍後再試。" />
          ) : videos.data.data.length === 0 ? (
            <GalgameState message="此品牌目前尚無影片。" />
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
                onChange={(_, value) => setParams(value > 1 ? { page: String(value) } : {})}
                sx={{ alignSelf: "center" }}
              />
            </>
          )
        )}
      </Stack>
    </Box>
  );
}
