import {
  Avatar,
  Box,
  Button,
  Grid,
  Pagination,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";

import { useGalgameBrand, useGalgameVideos } from "@/apis/galgame/catalog.ts";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { GalgameVideoCard } from "@/components/galgame/GalgameVideoCard.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { ExpandableText } from "@/components/common/ExpandableText.tsx";
import { useTitle } from "@/helpers/title.tsx";
import { galgamePath } from "@/helpers/galgame.ts";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

export default function GalgameBrand() {
  const { brandSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const brandQuery = useGalgameBrand(brandSlug);
  const brand = brandQuery.data;
  const videos = useGalgameVideos(brandSlug, { page, per_page: 24 });
  const pages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil((videos.data?.total ?? 0) / (videos.data?.per_page || 24)),
      ),
    [videos.data],
  );
  useTitle(brand ? `${brand.name} 影片` : "品牌影片");

  if (
    brandQuery.isError &&
    axios.isAxiosError(brandQuery.error) &&
    brandQuery.error.response?.status === 404
  ) {
    return <ErrorPage code={404} backUrl={`${galgamePath()}?tab=brands`} />;
  }

  return (
    <Box sx={{ pb: 6 }}>
      <GalgameBreadcrumb brand={brand} />
      <Stack spacing={3}>
        {brandQuery.isPending ? (
          <GalgameState loading message="正在載入品牌資料..." />
        ) : brandQuery.isError ? (
          <GalgameState
            severity="error"
            message="品牌資料載入失敗，請稍後再試。"
          />
        ) : brand ? (
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
                {brand.description && (
                  <ExpandableText text={brand.description} />
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
        ) : null}
        {brand &&
          (videos.isPending ? (
            <GalgameState loading message="正在載入品牌影片..." />
          ) : videos.isError ? (
            <GalgameState
              severity="error"
              message="影片載入失敗，請稍後再試。"
            />
          ) : videos.data.data.length === 0 ? (
            <GalgameState message="此品牌目前尚無影片。" />
          ) : (
            <>
              <Grid container spacing={3}>
                {videos.data.data.map((video) => (
                  <Grid
                    key={video.youtube_video_id}
                    size={{ xs: 12, sm: 6, md: 4 }}
                  >
                    <GalgameVideoCard video={video} />
                  </Grid>
                ))}
              </Grid>
              <Pagination
                page={page}
                count={pages}
                onChange={(_, value) =>
                  setParams(value > 1 ? { page: String(value) } : {})
                }
                sx={{ alignSelf: "center" }}
              />
            </>
          ))}
      </Stack>
    </Box>
  );
}
