import { useState } from "react";
import { Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import {
  useAdminGalgameVideoSubmissions,
  useSetGalgameVideoSubmissionStatus,
} from "@/apis/galgame/admin.ts";
import {
  ReviewButtons,
  VideoAdminCard,
} from "@/components/backendAdmin/galgame/GalgameAdminCards.tsx";
import {
  GALGAME_ADMIN_PAGE_SIZE,
  GalgameAdminList,
} from "@/components/backendAdmin/galgame/GalgameAdminList.tsx";
import { useActionFeedback } from "@/components/backendAdmin/useActionFeedback.tsx";

/** 待審影片：/backend_admin/galgame/video-submissions */
export function GalgameAdminVideoSubmissions() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const submissions = useAdminGalgameVideoSubmissions(
    "pending",
    page,
    GALGAME_ADMIN_PAGE_SIZE,
  );
  const setStatus = useSetGalgameVideoSubmissionStatus();
  const feedback = useActionFeedback(t("galgame.admin.actionFailed"));

  return (
    <Stack spacing={2}>
      <Typography component="h1" fontWeight={900} variant="h5">
        {t("galgame.admin.tabs.pendingVideos")}
      </Typography>
      <GalgameAdminList
        emptyMessage={t("galgame.admin.pendingVideos.empty")}
        loadingMessage={t("galgame.admin.pendingVideos.loading")}
        onPageChange={setPage}
        page={page}
        query={submissions}
        renderItem={(submission) => (
          <VideoAdminCard
            key={submission.id}
            subtitle={submission.youtube_channel_id}
            thumbnailUrl={submission.thumbnail_url}
            title={submission.title || submission.youtube_video_id}
          >
            <ReviewButtons
              disabled={setStatus.isPending}
              onReview={(status) =>
                setStatus.mutate(
                  { submissionId: submission.id, status },
                  { onError: feedback.failed },
                )
              }
            />
          </VideoAdminCard>
        )}
      />
      {feedback.snackbar}
    </Stack>
  );
}
