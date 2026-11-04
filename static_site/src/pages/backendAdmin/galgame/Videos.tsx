import { useState } from "react";
import { Button, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import RestoreIcon from "@mui/icons-material/Restore";
import { useTranslation } from "react-i18next";

import {
  useAdminGalgameVideos,
  useGalgameVideoAdminAction,
} from "@/apis/galgame/admin.ts";
import { VideoAdminCard } from "@/components/backendAdmin/galgame/GalgameAdminCards.tsx";
import {
  GALGAME_ADMIN_PAGE_SIZE,
  GalgameAdminList,
} from "@/components/backendAdmin/galgame/GalgameAdminList.tsx";
import { useActionFeedback } from "@/components/backendAdmin/useActionFeedback.tsx";
import { useTabParam } from "@/components/backendAdmin/useTabParam.ts";
import { ConfirmDialog } from "@/components/common/ConfirmDialog.tsx";
import type { GalgameVideo } from "@/types/galgame.ts";

const TABS = ["all", "deleted"] as const;

/** 影片管理：/backend_admin/galgame/videos?tab=all|deleted */
export function GalgameAdminVideos() {
  const { t } = useTranslation();
  const [tab, setTab] = useTabParam(TABS);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<GalgameVideo | null>(null);
  const videos = useAdminGalgameVideos(
    tab,
    keyword,
    page,
    GALGAME_ADMIN_PAGE_SIZE,
  );
  const action = useGalgameVideoAdminAction();
  const feedback = useActionFeedback(t("galgame.admin.actionFailed"));
  const run = (videoId: number, act: "delete" | "restore") =>
    action.mutate({ videoId, action: act }, { onError: feedback.failed });

  return (
    <Stack spacing={2}>
      <Typography component="h1" fontWeight={900} variant="h5">
        {t("galgame.admin.tabs.videos")}
      </Typography>
      <TextField
        label={t("galgame.admin.videos.search")}
        onChange={(event) => {
          setKeyword(event.target.value);
          setPage(1);
        }}
        size="small"
        value={keyword}
      />
      <Tabs
        onChange={(_, value: (typeof TABS)[number]) => {
          setTab(value);
          setPage(1);
        }}
        value={tab}
      >
        {TABS.map((key) => (
          <Tab
            key={key}
            label={t(`galgame.admin.videos.tabs.${key}`)}
            value={key}
          />
        ))}
      </Tabs>
      <GalgameAdminList
        emptyMessage={t("galgame.admin.videos.empty")}
        loadingMessage={t("galgame.admin.videos.loading")}
        onPageChange={setPage}
        page={page}
        query={videos}
        renderItem={(video) => (
          <VideoAdminCard
            key={video.id}
            subtitle={video.brand_name}
            thumbnailUrl={video.thumbnail_url}
            title={video.title}
          >
            {tab === "deleted" ? (
              <Button
                disabled={action.isPending}
                onClick={() => run(video.id, "restore")}
                startIcon={<RestoreIcon />}
              >
                {t("galgame.admin.actions.restore")}
              </Button>
            ) : (
              <Button
                color="error"
                disabled={action.isPending}
                onClick={() => setDeleting(video)}
                startIcon={<DeleteIcon />}
              >
                {t("galgame.admin.actions.deleteVideo")}
              </Button>
            )}
          </VideoAdminCard>
        )}
      />
      <ConfirmDialog
        cancelLabel={t("galgame.admin.confirm.cancel")}
        confirmLabel={t("galgame.admin.actions.deleteVideo")}
        loading={action.isPending}
        message={t("galgame.admin.confirm.deleteVideo", {
          title: deleting?.title,
        })}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) run(deleting.id, "delete");
          setDeleting(null);
        }}
        open={deleting !== null}
        title={t("galgame.admin.confirm.title")}
      />
      {feedback.snackbar}
    </Stack>
  );
}
