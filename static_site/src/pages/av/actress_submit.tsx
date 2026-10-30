import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { actressPagePath, useRoutedActress } from "@/helpers/avActressRef.ts";
import { Skeleton, Stack, Typography } from "@mui/material";
import type { ActressFields } from "@/types/avActressSubmission.ts";
import { useSubmitActress } from "@/apis/av/actress_submission.ts";
import { EMPTY_ACTRESS_FIELDS } from "@/data/avActressFields.ts";
import { actressToFields } from "@/helpers/avActressFields.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { useBreadcrumbTail } from "@/helpers/breadcrumbTail.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ActressSubmissionForm } from "@/components/av/actress_submission_form.tsx";
import { ActressSubmissionDone } from "@/components/av/actress_submission_done.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

/** 新增女優：/av/actress/submit */
export function AVActressSubmit() {
  useTitle("新增女優");
  const navigate = useNavigate();
  // 「再新增一位」時換 key，整個重置（表單與送出狀態）
  const [round, setRound] = useState(0);
  return (
    <SubmissionShell key={round} title="新增女優">
      {(submit, doneId, submitting) =>
        doneId ? (
          <ActressSubmissionDone
            backTo="/av/actress"
            id={doneId}
            onAgain={() => setRound((r) => r + 1)}
          />
        ) : (
          <ActressSubmissionForm
            initial={EMPTY_ACTRESS_FIELDS}
            onCancel={() => navigate("/av/actress")}
            onSubmit={(fields) => submit({ kind: "create", fields })}
            submitting={submitting}
          />
        )
      }
    </SubmissionShell>
  );
}

/** 修改女優資料：/av/actress/:name/edit，預填女優頁顯示的那一筆（網址參數規則同女優頁） */
export function AVActressEdit() {
  const { name = "" } = useParams<{ name: string }>();
  useTitle(`修改女優資料：${name}`);
  useBreadcrumbTail(`${name}・修改資料`);
  const navigate = useNavigate();
  const { actress, notFound } = useRoutedActress(name, "/edit");
  const backTo = actressPagePath(name, actress);

  if (notFound) {
    return (
      <ErrorPage
        backUrl="/av/actress"
        code={404}
        message={`找不到「${name}」的女優資料。`}
      />
    );
  }
  return (
    <SubmissionShell title={`修改女優資料：${name}`}>
      {(submit, doneId, submitting) =>
        doneId ? (
          <ActressSubmissionDone backTo={backTo} id={doneId} />
        ) : actress ? (
          <ActressSubmissionForm
            base={actressToFields(actress)}
            initial={actressToFields(actress)}
            onCancel={() => navigate(backTo)}
            onSubmit={(fields) =>
              submit({
                kind: "edit",
                target_domain: actress.domain,
                target_aid: actress.aid,
                fields,
              })
            }
            submitting={submitting}
          />
        ) : (
          <Skeleton height={480} variant="rounded" />
        )
      }
    </SubmissionShell>
  );
}

type Submit = (
  body: Parameters<ReturnType<typeof useSubmitActress>["mutate"]>[0],
) => void;

/** 新增／修改共用：年齡確認、標題、送出與錯誤 snack；送出成功後改顯示完成畫面 */
function SubmissionShell({
  title,
  children,
}: {
  title: string;
  children: (
    submit: Submit,
    doneId: number | null,
    submitting: boolean,
  ) => ReactNode;
}) {
  const mutation = useSubmitActress();
  const [snack, setSnack] = useState<string | null>(null);
  const submit: Submit = (body) =>
    mutation.mutate(
      { ...body, fields: trimLinks(body.fields) },
      {
        onError: (error) =>
          setSnack(apiErrorMessage(error, "送出失敗，請稍後再試")),
      },
    );

  return (
    <AgeConfirmationGate
      description="AV 女優資料包含成人內容。請確認你已年滿 18 歲後再繼續瀏覽。"
      leaveTo="/"
      panelTitle="AV 女優資料需要年齡確認"
    >
      <Stack spacing={2}>
        <Typography fontWeight={900} variant="h5" sx={{ textAlign: "left" }}>
          {title}
        </Typography>
        {children(submit, mutation.data?.id ?? null, mutation.isPending)}
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

// 沒填網址的連結列直接略過
const trimLinks = (fields: ActressFields): ActressFields => ({
  ...fields,
  links: fields.links.filter((l) => l.url.trim() !== ""),
});
