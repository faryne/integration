import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestoreIcon from "@mui/icons-material/Restore";
import { useState } from "react";

import {
  useAdminGalgameBrands,
  useAdminGalgameVideos,
  useAdminGalgameVideoSubmissions,
  useGalgameBrandAdminAction,
  useGalgameVideoAdminAction,
  useSetGalgameBrandStatus,
  useSetGalgameVideoSubmissionStatus,
} from "@/apis/galgame/catalog.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { useTitle } from "@/helpers/title.tsx";

type BrandTab = "all" | "deleted" | "paused";
type AdminTab = "brands" | "videos" | "pending-brands" | "pending-videos";
type VideoTab = "all" | "deleted";

const adminPageSize = 20;

export default function GalgameAdmin() {
  const { session, loading } = useAuth();
  const [adminTab, setAdminTab] = useState<AdminTab>("brands");
  const [brandTab, setBrandTab] = useState<BrandTab>("all");
  const [brandKeyword, setBrandKeyword] = useState("");
  const [brandPage, setBrandPage] = useState(1);
  const [videoKeyword, setVideoKeyword] = useState("");
  const [videoTab, setVideoTab] = useState<VideoTab>("all");
  const [videoPage, setVideoPage] = useState(1);
  const [pendingBrandPage, setPendingBrandPage] = useState(1);
  const [pendingVideoPage, setPendingVideoPage] = useState(1);
  const brandStatus = brandTab === "all" ? "approved" : brandTab;
  const brands = useAdminGalgameBrands(
    brandStatus,
    brandPage,
    adminPageSize,
    brandKeyword,
  );
  const pendingBrands = useAdminGalgameBrands(
    "pending",
    pendingBrandPage,
    adminPageSize,
  );
  const videos = useAdminGalgameVideos(
    videoTab,
    videoKeyword,
    videoPage,
    adminPageSize,
  );
  const submissions = useAdminGalgameVideoSubmissions(
    "pending",
    pendingVideoPage,
    adminPageSize,
  );
  const setBrandStatus = useSetGalgameBrandStatus();
  const brandAction = useGalgameBrandAdminAction();
  const videoAction = useGalgameVideoAdminAction();
  const setSubmissionStatus = useSetGalgameVideoSubmissionStatus();
  const brandRows = brands.data?.data ?? [];
  const pendingBrandRows = pendingBrands.data?.data ?? [];
  const videoRows = videos.data?.data ?? [];
  const submissionRows = submissions.data?.data ?? [];
  const brandPages = Math.max(
    1,
    Math.ceil((brands.data?.total ?? 0) / (brands.data?.per_page || adminPageSize)),
  );
  const videoPages = Math.max(
    1,
    Math.ceil((videos.data?.total ?? 0) / (videos.data?.per_page || adminPageSize)),
  );
  const pendingBrandPages = Math.max(
    1,
    Math.ceil(
      (pendingBrands.data?.total ?? 0) /
        (pendingBrands.data?.per_page || adminPageSize),
    ),
  );
  const pendingVideoPages = Math.max(
    1,
    Math.ceil(
      (submissions.data?.total ?? 0) /
        (submissions.data?.per_page || adminPageSize),
    ),
  );
  useTitle("Galgame 管理後台");

  if (loading) {
    return <GalgameState loading message="正在確認登入狀態..." />;
  }
  if (!session?.user.is_admin) {
    return <GalgameState message="需要管理員權限。" />;
  }

  return (
    <Box sx={{ pb: 6 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h3" component="h1">
            Galgame 管理後台
          </Typography>
          <Typography color="text.secondary">
            管理待審、索引狀態、刪除與影片審核。
          </Typography>
        </Box>

        <Tabs
          value={adminTab}
          onChange={(_, value: AdminTab) => setAdminTab(value)}
        >
          <Tab value="brands" label="頻道管理" />
          <Tab value="videos" label="影片管理" />
          <Tab value="pending-brands" label="待審頻道" />
          <Tab value="pending-videos" label="待審影片" />
        </Tabs>

        {adminTab === "brands" && (
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            頻道管理
          </Typography>
          <TextField
            label="搜尋頻道"
            value={brandKeyword}
            onChange={(event) => {
              setBrandKeyword(event.target.value);
              setBrandPage(1);
            }}
          />
          <Tabs
            value={brandTab}
            onChange={(_, value: BrandTab) => {
              setBrandTab(value);
              setBrandPage(1);
            }}
          >
            <Tab value="all" label="全部頻道" />
            <Tab value="deleted" label="已刪除頻道" />
            <Tab value="paused" label="暫停索引頻道" />
          </Tabs>
          {brands.isPending ? (
            <GalgameState loading message="正在載入頻道..." />
          ) : brandRows.length === 0 ? (
            <GalgameState message="沒有符合條件的頻道。" />
          ) : (
            <Grid container spacing={2}>
              {brandRows.map((brand) => (
                <Grid key={brand.id} size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar src={brand.avatar_url} alt={brand.name} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={700} noWrap>
                              {brand.name}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                              <Chip label={brand.status} size="small" />
                              {brand.index_paused_at && (
                                <Chip label="暫停索引" size="small" />
                              )}
                              {brand.deleted_at && (
                                <Chip label="已刪除" size="small" color="error" />
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {brand.status === "pending" && (
                            <>
                              <Button
                                color="success"
                                startIcon={<CheckIcon />}
                                disabled={setBrandStatus.isPending}
                                onClick={() =>
                                  void setBrandStatus.mutateAsync({
                                    brandId: brand.id,
                                    status: "approved",
                                  })
                                }
                              >
                                核准
                              </Button>
                              <Button
                                color="error"
                                startIcon={<CloseIcon />}
                                disabled={setBrandStatus.isPending}
                                onClick={() =>
                                  void setBrandStatus.mutateAsync({
                                    brandId: brand.id,
                                    status: "rejected",
                                  })
                                }
                              >
                                拒絕
                              </Button>
                            </>
                          )}
                          {brandTab === "deleted" ? (
                            <Button
                              startIcon={<RestoreIcon />}
                              disabled={brandAction.isPending}
                              onClick={() =>
                                void brandAction.mutateAsync({
                                  brandId: brand.id,
                                  action: "restore",
                                })
                              }
                            >
                              刪除回滾
                            </Button>
                          ) : brandTab === "paused" ? (
                            <Button
                              startIcon={<PlayArrowIcon />}
                              disabled={brandAction.isPending}
                              onClick={() =>
                                void brandAction.mutateAsync({
                                  brandId: brand.id,
                                  action: "resume",
                                })
                              }
                            >
                              重新啟動索引
                            </Button>
                          ) : (
                            <>
                              <Button
                                color="error"
                                startIcon={<DeleteIcon />}
                                disabled={brandAction.isPending}
                                onClick={() =>
                                  void brandAction.mutateAsync({
                                    brandId: brand.id,
                                    action: "delete",
                                  })
                                }
                              >
                                刪除
                              </Button>
                              <Button
                                startIcon={<PauseIcon />}
                                disabled={brandAction.isPending}
                                onClick={() =>
                                  void brandAction.mutateAsync({
                                    brandId: brand.id,
                                    action: "pause",
                                  })
                                }
                              >
                                暫停索引
                              </Button>
                            </>
                          )}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
          {(brands.data?.total ?? 0) > 0 && (
            <Pagination
              page={brandPage}
              count={brandPages}
              onChange={(_, value) => setBrandPage(value)}
              sx={{ alignSelf: "center" }}
            />
          )}
        </Stack>
        )}

        {adminTab === "videos" && (
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            影片管理
          </Typography>
          <TextField
            label="搜尋影片"
            value={videoKeyword}
            onChange={(event) => {
              setVideoKeyword(event.target.value);
              setVideoPage(1);
            }}
          />
          <Tabs
            value={videoTab}
            onChange={(_, value: VideoTab) => {
              setVideoTab(value);
              setVideoPage(1);
            }}
          >
            <Tab value="all" label="全部影片" />
            <Tab value="deleted" label="已刪除影片" />
          </Tabs>
          {videos.isPending ? (
            <GalgameState loading message="正在載入影片..." />
          ) : videoRows.length === 0 ? (
            <GalgameState message="沒有符合條件的影片。" />
          ) : (
            <Grid container spacing={2}>
              {videoRows.map((video) => (
                <Grid key={video.id} size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack direction="row" spacing={1.5}>
                        <Box
                          component="img"
                          src={video.thumbnail_url}
                          alt={video.title}
                          sx={{
                            width: 128,
                            aspectRatio: "16 / 9",
                            objectFit: "cover",
                            borderRadius: 1,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700} noWrap>
                            {video.title}
                          </Typography>
                          <Typography color="text.secondary" noWrap>
                            {video.brand_name}
                          </Typography>
                          {videoTab === "deleted" ? (
                            <Button
                              startIcon={<RestoreIcon />}
                              disabled={videoAction.isPending}
                              onClick={() =>
                                void videoAction.mutateAsync({
                                  videoId: video.id,
                                  action: "restore",
                                })
                              }
                              sx={{ mt: 1 }}
                            >
                              刪除回滾
                            </Button>
                          ) : (
                            <Button
                              color="error"
                              startIcon={<DeleteIcon />}
                              disabled={videoAction.isPending}
                              onClick={() =>
                                void videoAction.mutateAsync({
                                  videoId: video.id,
                                  action: "delete",
                                })
                              }
                              sx={{ mt: 1 }}
                            >
                              刪除影片
                            </Button>
                          )}
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
          {(videos.data?.total ?? 0) > 0 && (
            <Pagination
              page={videoPage}
              count={videoPages}
              onChange={(_, value) => setVideoPage(value)}
              sx={{ alignSelf: "center" }}
            />
          )}
        </Stack>
        )}

        {adminTab === "pending-brands" && (
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            待審頻道
          </Typography>
          {pendingBrands.isPending ? (
            <GalgameState loading message="正在載入待審頻道..." />
          ) : pendingBrandRows.length === 0 ? (
            <GalgameState message="目前沒有待審頻道。" />
          ) : (
            <Grid container spacing={2}>
              {pendingBrandRows.map((brand) => (
                <Grid key={brand.id} size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar src={brand.avatar_url} alt={brand.name} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700} noWrap>
                            {brand.name}
                          </Typography>
                          <Chip label={brand.status} size="small" />
                        </Box>
                        <Button
                          color="success"
                          startIcon={<CheckIcon />}
                          disabled={setBrandStatus.isPending}
                          onClick={() =>
                            void setBrandStatus.mutateAsync({
                              brandId: brand.id,
                              status: "approved",
                            })
                          }
                        >
                          核准
                        </Button>
                        <Button
                          color="error"
                          startIcon={<CloseIcon />}
                          disabled={setBrandStatus.isPending}
                          onClick={() =>
                            void setBrandStatus.mutateAsync({
                              brandId: brand.id,
                              status: "rejected",
                            })
                          }
                        >
                          拒絕
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
          {(pendingBrands.data?.total ?? 0) > 0 && (
            <Pagination
              page={pendingBrandPage}
              count={pendingBrandPages}
              onChange={(_, value) => setPendingBrandPage(value)}
              sx={{ alignSelf: "center" }}
            />
          )}
        </Stack>
        )}

        {adminTab === "pending-videos" && (
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            待審影片
          </Typography>
          {submissions.isPending ? (
            <GalgameState loading message="正在載入待審影片..." />
          ) : submissionRows.length === 0 ? (
            <GalgameState message="目前沒有待審影片。" />
          ) : (
            <Grid container spacing={2}>
              {submissionRows.map((submission) => (
                <Grid key={submission.id} size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack direction="row" spacing={1.5}>
                        <Box
                          component="img"
                          src={submission.thumbnail_url}
                          alt={submission.title}
                          sx={{
                            width: 128,
                            aspectRatio: "16 / 9",
                            objectFit: "cover",
                            borderRadius: 1,
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700} noWrap>
                            {submission.title || submission.youtube_video_id}
                          </Typography>
                          <Typography color="text.secondary" noWrap>
                            {submission.youtube_channel_id}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Button
                              color="success"
                              startIcon={<CheckIcon />}
                              disabled={setSubmissionStatus.isPending}
                              onClick={() =>
                                void setSubmissionStatus.mutateAsync({
                                  submissionId: submission.id,
                                  status: "approved",
                                })
                              }
                            >
                              核准
                            </Button>
                            <Button
                              color="error"
                              startIcon={<CloseIcon />}
                              disabled={setSubmissionStatus.isPending}
                              onClick={() =>
                                void setSubmissionStatus.mutateAsync({
                                  submissionId: submission.id,
                                  status: "rejected",
                                })
                              }
                            >
                              拒絕
                            </Button>
                          </Stack>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
          {(submissions.data?.total ?? 0) > 0 && (
            <Pagination
              page={pendingVideoPage}
              count={pendingVideoPages}
              onChange={(_, value) => setPendingVideoPage(value)}
              sx={{ alignSelf: "center" }}
            />
          )}
        </Stack>
        )}
      </Stack>
    </Box>
  );
}
