import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Link as RouterLink, useParams } from "react-router-dom";

import {
  useGalgameVideo,
  useGalgameVideoFavorite,
  useGalgameVideoNavigation,
  useRelatedGalgameVideos,
} from "@/apis/galgame/catalog.ts";
import { VideoViewer } from "@/components/common/VideoViewer.tsx";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { ExpandableText } from "@/components/common/ExpandableText.tsx";
import { galgameBrandSlug, galgamePath } from "@/helpers/galgame.ts";
import { useTitle } from "@/helpers/title.tsx";
import { RelatedVideoList } from "@/components/galgame/RelatedVideoList.tsx";
import { FavoriteButton } from "@/components/galgame/FavoriteButton.tsx";

export default function GalgameVideo() {
  const { brandSlug, videoId } = useParams();
  const query = useGalgameVideo(brandSlug, videoId);
  const related = useRelatedGalgameVideos(brandSlug, videoId);
  const favorite = useGalgameVideoFavorite(brandSlug, videoId);
  const navigation = useGalgameVideoNavigation(brandSlug, videoId);
  const video = query.data;
  useTitle(video?.title ?? "Galgame 影片");

  return (
    <Box sx={{ pb: 6 }}>
      <GalgameBreadcrumb
        brand={
          video
            ? { public_id: video.brand_public_id, name: video.brand_name }
            : undefined
        }
        videoTitle={video?.title}
      />
      {query.isPending ? (
        <GalgameState loading message="正在載入影片..." />
      ) : query.isError || !video ? (
        <GalgameState severity="error" message="影片不存在或載入失敗。" />
      ) : (
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{ flex: 1 }}
            >
              <Typography variant="h4" component="h1">
                {video.title}
              </Typography>
              <FavoriteButton
                label="影片"
                favorite={favorite.favorite}
                loading={favorite.isFetching || favorite.mutation.isPending}
                onToggle={(value) => favorite.mutation.mutateAsync(value)}
              />
            </Stack>
          </Stack>
          <Grid container spacing={3} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 8 }}>
              <VideoViewer
                title={video.title}
                videos={[
                  {
                    url: `https://www.youtube.com/watch?v=${video.youtube_video_id}`,
                    thumb: video.thumbnail_url,
                  },
                ]}
              />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ mt: 2 }}
              >
                <Card
                  variant="outlined"
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    opacity: navigation.data?.previous ? 1 : 0.5,
                  }}
                >
                  <CardActionArea
                    component={
                      navigation.data?.previous ? RouterLink : "button"
                    }
                    to={
                      navigation.data?.previous
                        ? galgamePath(
                            `${galgameBrandSlug(navigation.data.previous.brand_public_id, navigation.data.previous.brand_name)}/video/${navigation.data.previous.youtube_video_id}`,
                          )
                        : undefined
                    }
                    disabled={!navigation.data?.previous}
                    sx={{ height: "100%", textAlign: "left" }}
                  >
                    <CardContent>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.5}
                        color="text.secondary"
                      >
                        <NavigateBeforeIcon fontSize="small" />
                        <Typography variant="caption" fontWeight={700}>
                          上一則影片
                        </Typography>
                      </Stack>
                      <Typography
                        variant="subtitle1"
                        fontWeight={700}
                        sx={{
                          mt: 0.75,
                          display: "-webkit-box",
                          overflow: "hidden",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                        }}
                      >
                        {navigation.data?.previous?.title ?? "沒有上一則影片"}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
                <Card
                  variant="outlined"
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    opacity: navigation.data?.next ? 1 : 0.5,
                  }}
                >
                  <CardActionArea
                    component={navigation.data?.next ? RouterLink : "button"}
                    to={
                      navigation.data?.next
                        ? galgamePath(
                            `${galgameBrandSlug(navigation.data.next.brand_public_id, navigation.data.next.brand_name)}/video/${navigation.data.next.youtube_video_id}`,
                          )
                        : undefined
                    }
                    disabled={!navigation.data?.next}
                    sx={{ height: "100%", textAlign: "right" }}
                  >
                    <CardContent>
                      <Stack
                        direction="row"
                        justifyContent="flex-end"
                        alignItems="center"
                        spacing={0.5}
                        color="text.secondary"
                      >
                        <Typography variant="caption" fontWeight={700}>
                          下一則影片
                        </Typography>
                        <NavigateNextIcon fontSize="small" />
                      </Stack>
                      <Typography
                        variant="subtitle1"
                        fontWeight={700}
                        sx={{
                          mt: 0.75,
                          display: "-webkit-box",
                          overflow: "hidden",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                        }}
                      >
                        {navigation.data?.next?.title ?? "沒有下一則影片"}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 1.5,
                  }}
                >
                  <Avatar
                    src={video.brand_avatar_url}
                    alt={video.brand_name}
                    sx={{ width: 52, height: 52 }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Link
                      component={RouterLink}
                      to={galgamePath(
                        galgameBrandSlug(
                          video.brand_public_id,
                          video.brand_name,
                        ),
                      )}
                      variant="subtitle1"
                      fontWeight={700}
                      underline="hover"
                    >
                      {video.brand_name}
                    </Link>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(video.published_at).toLocaleDateString("zh-TW")}
                    </Typography>
                  </Box>
                  <Button
                    component="a"
                    href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    endIcon={<OpenInNewIcon />}
                  >
                    YouTube
                  </Button>
                </Stack>
                <Accordion disableGutters>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="video-description-content"
                    id="video-description-header"
                  >
                    <Typography variant="h6">影片介紹</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {video.description ? (
                      <ExpandableText
                        text={video.description}
                        collapsedLines={8}
                      />
                    ) : (
                      <Typography color="text.secondary">
                        此影片沒有介紹。
                      </Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
                <Accordion defaultExpanded disableGutters>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="related-videos-content"
                    id="related-videos-header"
                  >
                    <Typography variant="h6">相關影片</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <RelatedVideoList
                      loading={related.isPending}
                      error={related.isError}
                      videos={related.data ?? []}
                      showTitle={false}
                    />
                  </AccordionDetails>
                </Accordion>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      )}
    </Box>
  );
}
