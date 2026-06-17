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

import { useSubmitGalgameVideos } from "@/apis/galgame/catalog.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { useTitle } from "@/helpers/title.tsx";

export default function GalgameSubmitVideo() {
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
  useTitle("追加 Galgame 影片");
  const submitErrorMessage =
    submit.error && axios.isAxiosError(submit.error)
      ? (submit.error.response?.data as { message?: string } | undefined)
          ?.message
      : undefined;

  if (loading) {
    return <GalgameState loading message="正在確認登入狀態..." />;
  }

  return (
    <Box sx={{ pb: 6 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h3" component="h1">
            追加 YouTube 影片
          </Typography>
          <Typography color="text.secondary">
            一行放置一個網址，支援 youtu.be 或 youtube.com/watch?v= 格式。
          </Typography>
        </Box>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <TextField
                label="YouTube 影片"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                multiline
                minRows={6}
                placeholder={
                  "一行放置一個網址\nhttps://youtu.be/xxxxxxxxxxx\nhttps://www.youtube.com/watch?v=xxxxxxxxxxx"
                }
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  disabled={urls.length === 0 || submit.isPending}
                  onClick={() => void submit.mutateAsync(urls)}
                >
                  {submit.isPending
                    ? "送出中..."
                    : `送出${urls.length > 0 ? ` ${urls.length}` : ""}`}
                </Button>
                {submit.isError && (
                  <Typography color="error">
                    {submitErrorMessage ?? "送出失敗，請稍後再試。"}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {submit.isPending && (
          <Alert severity="info">正在解析 YouTube 影片，請稍候。</Alert>
        )}

        {submit.isSuccess && (submit.data?.length ?? 0) === 0 && (
          <Alert severity="warning">
            沒有送出任何影片，請確認每行都有填入 YouTube 影片網址。
          </Alert>
        )}

        {submit.data && submit.data.length > 0 && (
          <Stack spacing={1}>
            {submit.data.map((result) => {
              const duplicateNotice =
                result.error === "影片已存在" ||
                result.error?.includes("已被提出");
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
                    ? `${result.submission?.title ?? result.input}: ${result.error}`
                    : `${result.submission?.title ?? result.input}: ${
                        result.created ? "已送出，等待管理者核准。" : `已存在（${result.submission?.status ?? "unknown"}）`
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
