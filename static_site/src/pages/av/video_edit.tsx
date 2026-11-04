import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Skeleton, Stack, Typography } from "@mui/material";
import { useAVVideoSearch } from "@/apis/av/video_search.ts";
import { useSubmitVideo } from "@/apis/av/video_submission.ts";
import { videoToFields } from "@/helpers/avVideoFields.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { useBreadcrumbTail } from "@/helpers/breadcrumbTail.ts";
import { AV_VIDEO_SECTION, sectionTitle, useTitle } from "@/helpers/title.tsx";
import { VideoSubmissionForm } from "@/components/av/video_submission_form.tsx";
import { SubmissionDone } from "@/components/av/submission_done.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

/** 修改影片資料：/av/video/:no/edit，:no 規則同詳細頁（官方番號或內部番號） */
export function AVVideoEdit() {
  const { no = "" } = useParams<{ no: string }>();
  const v = useAVVideoSearch({ page: 1, no }, !!no);
  const video = v.data?.data?.data?.[0];
  // 沒有官方番號的舊資料顯示 DMM 內部番號（同詳細頁）
  const code = video ? video.maker_no?.trim() || video.no.toUpperCase() : no;
  useTitle(sectionTitle(AV_VIDEO_SECTION, `修改影片資料：${code}`));
  useBreadcrumbTail(`${code}・修改資料`);
  const navigate = useNavigate();
  const backTo = `/av/video/${encodeURIComponent(no)}`;
  const mutation = useSubmitVideo();
  const [snack, setSnack] = useState<string | null>(null);

  if (!no || (v.isSuccess && !video)) {
    return (
      <ErrorPage
        backUrl="/av/video"
        code={404}
        message={`找不到番號「${no}」的影片。`}
      />
    );
  }
  return (
    <AgeConfirmationGate
      description="AV 影片資料包含成人內容。請確認你已年滿 18 歲後再繼續瀏覽。"
      leaveTo="/av/video"
      panelTitle="AV 影片資料需要年齡確認"
    >
      <Stack spacing={2}>
        <Typography fontWeight={900} variant="h5" sx={{ textAlign: "left" }}>
          修改影片資料：{code}
        </Typography>
        {mutation.data ? (
          <SubmissionDone
            backLabel="回到影片"
            backTo={backTo}
            id={mutation.data.id}
          />
        ) : video ? (
          <VideoSubmissionForm
            base={videoToFields(video)}
            onCancel={() => navigate(backTo)}
            onSubmit={(fields) =>
              mutation.mutate(
                {
                  target_no: video.no,
                  // 沒填網址的連結列直接略過
                  fields: {
                    ...fields,
                    links: fields.links.filter((l) => l.url.trim() !== ""),
                  },
                },
                {
                  onError: (error) =>
                    setSnack(apiErrorMessage(error, "送出失敗，請稍後再試")),
                },
              )
            }
            submitting={mutation.isPending}
            thumb={video.thumb}
          />
        ) : (
          <Skeleton height={480} variant="rounded" />
        )}
      </Stack>
      <CustomSnackbar
        message={snack ?? ""}
        onClose={() => setSnack(null)}
        open={snack !== null}
        severity="error"
      />
    </AgeConfirmationGate>
  );
}
