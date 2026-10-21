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
import SyncIcon from "@mui/icons-material/Sync";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useAdminGalgameBrands,
  useAdminGalgameVideos,
  useAdminGalgameVideoSubmissions,
  useAdminGalgameVideoTitleKeywords,
  useCreateGalgameVideoTitleKeyword,
  useDeleteGalgameVideoTitleKeyword,
  useGalgameBrandAdminAction,
  useGalgameVideoAdminAction,
  useSetGalgameBrandStatus,
  useSetGalgameVideoSubmissionStatus,
  useUpdateGalgameVideoTitleKeyword,
} from "@/apis/galgame/catalog.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { GalgamePageHeader } from "@/components/galgame/GalgamePageHeader.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { useTitle } from "@/helpers/title.tsx";

type BrandTab = "all" | "deleted" | "paused";
type AdminTab =
  "brands" | "videos" | "pending-brands" | "pending-videos" | "title-keywords";
type VideoTab = "all" | "deleted";

const adminPageSize = 20;

export default function GalgameAdmin() {
  const { t } = useTranslation();
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
  const [titleKeyword, setTitleKeyword] = useState("");
  const [titleKeywordEnabled, setTitleKeywordEnabled] = useState("all");
  const [titleKeywordPage, setTitleKeywordPage] = useState(1);
  const [newTitleKeyword, setNewTitleKeyword] = useState("");
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
  const titleKeywords = useAdminGalgameVideoTitleKeywords(
    titleKeyword,
    titleKeywordEnabled,
    titleKeywordPage,
    adminPageSize,
  );
  const setBrandStatus = useSetGalgameBrandStatus();
  const brandAction = useGalgameBrandAdminAction();
  const videoAction = useGalgameVideoAdminAction();
  const setSubmissionStatus = useSetGalgameVideoSubmissionStatus();
  const createTitleKeyword = useCreateGalgameVideoTitleKeyword();
  const updateTitleKeyword = useUpdateGalgameVideoTitleKeyword();
  const deleteTitleKeyword = useDeleteGalgameVideoTitleKeyword();
  const brandRows = brands.data?.data ?? [];
  const pendingBrandRows = pendingBrands.data?.data ?? [];
  const videoRows = videos.data?.data ?? [];
  const submissionRows = submissions.data?.data ?? [];
  const titleKeywordRows = titleKeywords.data?.data ?? [];
  const brandPages = Math.max(
    1,
    Math.ceil(
      (brands.data?.total ?? 0) / (brands.data?.per_page || adminPageSize),
    ),
  );
  const videoPages = Math.max(
    1,
    Math.ceil(
      (videos.data?.total ?? 0) / (videos.data?.per_page || adminPageSize),
    ),
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
  const titleKeywordPages = Math.max(
    1,
    Math.ceil(
      (titleKeywords.data?.total ?? 0) /
        (titleKeywords.data?.per_page || adminPageSize),
    ),
  );
  useTitle(t("galgame.admin.heading"));

  if (loading) {
    return <GalgameState loading message={t("galgame.authGate.checking")} />;
  }
  if (!session?.user.is_admin) {
    return (
      <>
        <GalgamePageHeader current={t("galgame.admin.heading")} />
        <GalgameState message={t("galgame.admin.noPermission")} />
      </>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      <GalgamePageHeader
        current={t("galgame.admin.heading")}
        title={t("galgame.admin.heading")}
        subtitle={t("galgame.admin.subtitle")}
      />
      <Stack spacing={4}>
        <Tabs
          value={adminTab}
          onChange={(_, value: AdminTab) => setAdminTab(value)}
        >
          <Tab value="brands" label={t("galgame.admin.tabs.brands")} />
          <Tab value="videos" label={t("galgame.admin.tabs.videos")} />
          <Tab
            value="pending-brands"
            label={t("galgame.admin.tabs.pendingBrands")}
          />
          <Tab
            value="pending-videos"
            label={t("galgame.admin.tabs.pendingVideos")}
          />
          <Tab
            value="title-keywords"
            label={t("galgame.admin.tabs.titleKeywords")}
          />
        </Tabs>

        {adminTab === "brands" && (
          <Stack spacing={2}>
            <Typography variant="h5" component="h2">
              {t("galgame.admin.tabs.brands")}
            </Typography>
            <TextField
              label={t("galgame.admin.brands.search")}
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
              <Tab value="all" label={t("galgame.admin.brands.tabs.all")} />
              <Tab
                value="deleted"
                label={t("galgame.admin.brands.tabs.deleted")}
              />
              <Tab
                value="paused"
                label={t("galgame.admin.brands.tabs.paused")}
              />
            </Tabs>
            {brands.isPending ? (
              <GalgameState
                loading
                message={t("galgame.admin.brands.loading")}
              />
            ) : brandRows.length === 0 ? (
              <GalgameState message={t("galgame.admin.brands.empty")} />
            ) : (
              <Grid container spacing={2}>
                {brandRows.map((brand) => (
                  <Grid key={brand.id} size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack spacing={2}>
                          <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                          >
                            <Avatar src={brand.avatar_url} alt={brand.name} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography fontWeight={700} noWrap>
                                {brand.name}
                              </Typography>
                              <Stack
                                direction="row"
                                spacing={1}
                                sx={{ mt: 0.75 }}
                              >
                                <Chip
                                  label={t(`galgame.status.${brand.status}`)}
                                  size="small"
                                />
                                {brand.index_paused_at && (
                                  <Chip
                                    label={t("galgame.admin.brands.paused")}
                                    size="small"
                                  />
                                )}
                                {brand.deleted_at && (
                                  <Chip
                                    label={t("galgame.admin.deleted")}
                                    size="small"
                                    color="error"
                                  />
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
                                  {t("galgame.admin.actions.approve")}
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
                                  {t("galgame.admin.actions.reject")}
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
                                {t("galgame.admin.actions.restore")}
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
                                {t("galgame.admin.actions.resumeIndexing")}
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
                                  {t("galgame.admin.actions.delete")}
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
                                  {t("galgame.admin.actions.pauseIndexing")}
                                </Button>
                                <Button
                                  startIcon={<SyncIcon />}
                                  disabled={brandAction.isPending}
                                  onClick={() =>
                                    void brandAction.mutateAsync({
                                      brandId: brand.id,
                                      action: "sync",
                                    })
                                  }
                                >
                                  {t("galgame.admin.actions.fullIndex")}
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
              {t("galgame.admin.tabs.videos")}
            </Typography>
            <TextField
              label={t("galgame.admin.videos.search")}
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
              <Tab value="all" label={t("galgame.admin.videos.tabs.all")} />
              <Tab
                value="deleted"
                label={t("galgame.admin.videos.tabs.deleted")}
              />
            </Tabs>
            {videos.isPending ? (
              <GalgameState
                loading
                message={t("galgame.admin.videos.loading")}
              />
            ) : videoRows.length === 0 ? (
              <GalgameState message={t("galgame.admin.videos.empty")} />
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
                                {t("galgame.admin.actions.restore")}
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
                                {t("galgame.admin.actions.deleteVideo")}
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
              {t("galgame.admin.tabs.pendingBrands")}
            </Typography>
            {pendingBrands.isPending ? (
              <GalgameState
                loading
                message={t("galgame.admin.pendingBrands.loading")}
              />
            ) : pendingBrandRows.length === 0 ? (
              <GalgameState message={t("galgame.admin.pendingBrands.empty")} />
            ) : (
              <Grid container spacing={2}>
                {pendingBrandRows.map((brand) => (
                  <Grid key={brand.id} size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          <Avatar src={brand.avatar_url} alt={brand.name} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={700} noWrap>
                              {brand.name}
                            </Typography>
                            <Chip
                              label={t(`galgame.status.${brand.status}`)}
                              size="small"
                            />
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
                            {t("galgame.admin.actions.approve")}
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
                            {t("galgame.admin.actions.reject")}
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
              {t("galgame.admin.tabs.pendingVideos")}
            </Typography>
            {submissions.isPending ? (
              <GalgameState
                loading
                message={t("galgame.admin.pendingVideos.loading")}
              />
            ) : submissionRows.length === 0 ? (
              <GalgameState message={t("galgame.admin.pendingVideos.empty")} />
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
                                {t("galgame.admin.actions.approve")}
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
                                {t("galgame.admin.actions.reject")}
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

        {adminTab === "title-keywords" && (
          <Stack spacing={2}>
            <Typography variant="h5" component="h2">
              {t("galgame.admin.tabs.titleKeywords")}
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                label={t("galgame.admin.keywords.new")}
                value={newTitleKeyword}
                onChange={(event) => setNewTitleKeyword(event.target.value)}
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                disabled={
                  newTitleKeyword.trim() === "" || createTitleKeyword.isPending
                }
                onClick={() =>
                  void createTitleKeyword
                    .mutateAsync(newTitleKeyword.trim())
                    .then(() => setNewTitleKeyword(""))
                }
              >
                {t("galgame.admin.actions.add")}
              </Button>
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                label={t("galgame.admin.keywords.search")}
                value={titleKeyword}
                onChange={(event) => {
                  setTitleKeyword(event.target.value);
                  setTitleKeywordPage(1);
                }}
                sx={{ flex: 1 }}
              />
              <Tabs
                value={titleKeywordEnabled}
                onChange={(_, value: string) => {
                  setTitleKeywordEnabled(value);
                  setTitleKeywordPage(1);
                }}
              >
                <Tab value="all" label={t("galgame.admin.keywords.tabs.all")} />
                <Tab
                  value="true"
                  label={t("galgame.admin.keywords.tabs.enabled")}
                />
                <Tab
                  value="false"
                  label={t("galgame.admin.keywords.tabs.disabled")}
                />
              </Tabs>
            </Stack>
            {titleKeywords.isPending ? (
              <GalgameState
                loading
                message={t("galgame.admin.keywords.loading")}
              />
            ) : titleKeywordRows.length === 0 ? (
              <GalgameState message={t("galgame.admin.keywords.empty")} />
            ) : (
              <Grid container spacing={2}>
                {titleKeywordRows.map((keyword) => (
                  <Grid key={keyword.id} size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={700} noWrap>
                              {keyword.keyword}
                            </Typography>
                            <Chip
                              label={t(
                                keyword.enabled
                                  ? "galgame.admin.keywords.enabled"
                                  : "galgame.admin.keywords.disabled",
                              )}
                              color={keyword.enabled ? "success" : "default"}
                              size="small"
                              sx={{ mt: 0.75 }}
                            />
                          </Box>
                          <Button
                            disabled={updateTitleKeyword.isPending}
                            onClick={() =>
                              void updateTitleKeyword.mutateAsync({
                                keywordId: keyword.id,
                                enabled: !keyword.enabled,
                              })
                            }
                          >
                            {t(
                              keyword.enabled
                                ? "galgame.admin.actions.disable"
                                : "galgame.admin.actions.enable",
                            )}
                          </Button>
                          <Button
                            color="error"
                            startIcon={<DeleteIcon />}
                            disabled={deleteTitleKeyword.isPending}
                            onClick={() =>
                              void deleteTitleKeyword.mutateAsync(keyword.id)
                            }
                          >
                            {t("galgame.admin.actions.delete")}
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
            {(titleKeywords.data?.total ?? 0) > 0 && (
              <Pagination
                page={titleKeywordPage}
                count={titleKeywordPages}
                onChange={(_, value) => setTitleKeywordPage(value)}
                sx={{ alignSelf: "center" }}
              />
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
