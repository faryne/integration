import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import axios from "axios";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSubmitGalgameVideos } from "@/apis/galgame/catalog.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { GalgamePageHeader } from "@/components/galgame/GalgamePageHeader.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { useTitle } from "@/helpers/title.tsx";

export default function GalgameSubmitVideo() {
  const { t } = useTranslation();
  const { loading } = useAuth();
  const [input, setInput] = useState("");
  const submit = useSubmitGalgameVideos();
  const urls = useMemo(
    () =>
      input
        .split(/\n+/)
        .map((value) => value.trim())
        .filter(Boolean),
    [input],
  );
  useTitle(t("galgame.submitVideo.pageTitle"));
  const submitErrorMessage =
    submit.error && axios.isAxiosError(submit.error)
      ? (submit.error.response?.data as { message?: string } | undefined)
          ?.message
      : undefined;

  if (loading) {
    return <GalgameState loading message={t("galgame.authGate.checking")} />;
  }

  return (
    <Box sx={{ pb: 6 }}>
      <GalgamePageHeader
        current={t("galgame.submitVideo.heading")}
        title={t("galgame.submitVideo.heading")}
        subtitle={t("galgame.submitVideo.hint")}
      />
      <Stack spacing={3}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <TextField
                label={t("galgame.submitVideo.fieldLabel")}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                multiline
                minRows={6}
                placeholder={t("galgame.submitVideo.placeholder")}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  disabled={urls.length === 0 || submit.isPending}
                  onClick={() => void submit.mutateAsync(urls)}
                >
                  {submit.isPending
                    ? t("galgame.submitVideo.submitting")
                    : urls.length > 0
                      ? t("galgame.submitVideo.submitCount", {
                          count: urls.length,
                        })
                      : t("galgame.submitVideo.submit")}
                </Button>
                {submit.isError && (
                  <Typography color="error">
                    {submitErrorMessage ?? t("galgame.submitVideo.submitError")}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {submit.isPending && (
          <Alert severity="info">{t("galgame.submitVideo.parsing")}</Alert>
        )}

        {submit.isSuccess && (submit.data?.length ?? 0) === 0 && (
          <Alert severity="warning">
            {t("galgame.submitVideo.nothingSubmitted")}
          </Alert>
        )}

        {submit.data && submit.data.length > 0 && (
          <Stack spacing={1}>
            {submit.data.map((result) => {
              // 後端目前回傳中文錯誤字串，先在前端對應成翻譯；之後後端改回 error code 再換掉
              const duplicateMessage =
                result.error === "影片已存在"
                  ? t("galgame.submitVideo.duplicateExists")
                  : result.error?.includes("已被提出")
                    ? t("galgame.submitVideo.duplicatePending")
                    : undefined;
              const duplicateNotice = Boolean(duplicateMessage);
              return (
                <Alert
                  key={result.input}
                  severity={
                    result.error
                      ? duplicateNotice
                        ? "warning"
                        : "error"
                      : result.created
                        ? "success"
                        : "info"
                  }
                >
                  {result.error
                    ? `${result.submission?.title ?? result.input}: ${duplicateMessage ?? result.error}`
                    : `${result.submission?.title ?? result.input}: ${
                        result.created
                          ? t("galgame.submitVideo.submitted")
                          : t("galgame.submitVideo.alreadyExists", {
                              status: t(
                                `galgame.status.${result.submission?.status ?? "unknown"}`,
                              ),
                            })
                      }`}
                </Alert>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
