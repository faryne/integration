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

import { useSubmitGalgameBrands } from "@/apis/galgame/catalog.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { useTitle } from "@/helpers/title.tsx";

export default function GalgameSubmitBrand() {
  const { t } = useTranslation();
  const { loading } = useAuth();
  const [input, setInput] = useState("");
  const submit = useSubmitGalgameBrands();
  const channels = useMemo(
    () =>
      input
        .split(/\n+/)
        .map((value) => value.trim())
        .filter(Boolean),
    [input],
  );
  useTitle(t("galgame.submitBrand.pageTitle"));
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
      <Stack spacing={3}>
        <Box>
          <Typography variant="h3" component="h1">
            {t("galgame.submitBrand.heading")}
          </Typography>
          <Typography color="text.secondary">
            {t("galgame.submitBrand.hint")}
          </Typography>
        </Box>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <TextField
                label={t("galgame.submitBrand.fieldLabel")}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                multiline
                minRows={6}
                placeholder={t("galgame.submitBrand.placeholder")}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  disabled={channels.length === 0 || submit.isPending}
                  onClick={() => void submit.mutateAsync(channels)}
                >
                  {submit.isPending
                    ? t("galgame.submitBrand.submitting")
                    : channels.length > 0
                      ? t("galgame.submitBrand.submitCount", {
                          count: channels.length,
                        })
                      : t("galgame.submitBrand.submit")}
                </Button>
                {submit.isError && (
                  <Typography color="error">
                    {submitErrorMessage ?? t("galgame.submitBrand.submitError")}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {submit.isPending && (
          <Alert severity="info">{t("galgame.submitBrand.parsing")}</Alert>
        )}

        {submit.isSuccess && (submit.data?.length ?? 0) === 0 && (
          <Alert severity="warning">
            {t("galgame.submitBrand.nothingSubmitted")}
          </Alert>
        )}

        {submit.data && submit.data.length > 0 && (
          <Stack spacing={1}>
            {submit.data.map((result) => (
              <Alert
                key={result.input}
                severity={
                  result.error ? "error" : result.created ? "success" : "info"
                }
              >
                {result.error
                  ? `${result.input}: ${result.error}`
                  : `${result.brand?.name ?? result.input}: ${
                      result.created
                        ? t("galgame.submitBrand.submitted")
                        : t("galgame.submitBrand.alreadyExists", {
                            status: t(
                              `galgame.status.${result.brand?.status ?? "unknown"}`,
                            ),
                          })
                    }`}
              </Alert>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
