import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { type FormEvent, useMemo, useState } from "react";
import { useCaptureThread } from "@/apis/tools/capture_thread.ts";
import { useTitle } from "@/helpers/title.tsx";

function isValidThreadsUrl(input: string): boolean {
  const trimmed = input.trim();

  if (!trimmed) {
    return false;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      (host === "threads.net" ||
        host.endsWith(".threads.net") ||
        host === "threads.com" ||
        host.endsWith(".threads.com"))
    );
  } catch {
    return false;
  }
}

function createDownloadFilename(input: string): string {
  try {
    const url = new URL(input.trim());
    const parts = url.pathname.split("/").filter(Boolean).slice(-3).join("-");
    const suffix = parts || url.hostname;

    return `threads-${suffix.replace(/[^a-zA-Z0-9._-]/g, "-")}.png`;
  } catch {
    return "threads-capture.png";
  }
}

export function CaptureThread() {
  const [uri, setUri] = useState<string>("");
  const captureThread = useCaptureThread();
  const trimmedUri = uri.trim();
  const showUrlError = uri.length > 0 && !isValidThreadsUrl(uri);
  const imageData = captureThread.data?.data?.img;
  const imageSrc = useMemo(() => {
    if (!imageData) {
      return "";
    }

    return `data:image/png;base64,${imageData}`;
  }, [imageData]);
  const responseMessage = captureThread.data?.message ?? "";
  const hasCaptureError =
    captureThread.isError ||
    (captureThread.isSuccess &&
      responseMessage !== "" &&
      responseMessage !== "OK");
  const helperText = showUrlError
    ? "請輸入 Threads 貼文網址，例如 https://www.threads.com/@user/post/..."
    : "支援 threads.com 與 threads.net 的公開貼文網址。";

  useTitle("Threads 截圖工具");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidThreadsUrl(trimmedUri) || captureThread.isPending) {
      return;
    }

    captureThread.mutate({ url: trimmedUri });
  }

  function handleDownload() {
    if (!imageSrc) {
      return;
    }

    const link = document.createElement("a");
    link.href = imageSrc;
    link.download = createDownloadFilename(trimmedUri);
    link.click();
  }

  function handleOpenImage() {
    if (!imageSrc) {
      return;
    }

    window.open(imageSrc, "_blank", "noopener,noreferrer");
  }

  return (
    <Stack
      component="form"
      direction="column"
      spacing={2}
      onSubmit={handleSubmit}
      sx={{ maxWidth: 920, mx: "auto" }}
    >
      <Box>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
          Threads 截圖工具
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          貼上公開 Threads 貼文網址，產生可下載的 PNG 截圖。
        </Typography>
      </Box>

      {hasCaptureError && (
        <Alert severity="error">
          {responseMessage || "截圖失敗，請稍後再試。"}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          label="Threads 貼文網址"
          size="medium"
          fullWidth
          placeholder="https://www.threads.com/@username/post/..."
          value={uri}
          type="url"
          error={showUrlError}
          helperText={helperText}
          disabled={captureThread.isPending}
          onChange={(e) => setUri(e.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={!isValidThreadsUrl(trimmedUri) || captureThread.isPending}
          startIcon={
            captureThread.isPending ? (
              <CircularProgress color="inherit" size={18} />
            ) : (
              <PhotoCameraIcon />
            )
          }
          sx={{
            minWidth: { xs: "100%", sm: 132 },
            alignSelf: { xs: "stretch", sm: "flex-start" },
            py: 1.75,
          }}
        >
          {captureThread.isPending ? "產生中" : "產生截圖"}
        </Button>
      </Stack>

      {imageSrc && (
        <Card variant="outlined" sx={{ overflow: "hidden" }}>
          <CardContent sx={{ p: 0, bgcolor: "grey.100" }}>
            <Box
              component="img"
              src={imageSrc}
              alt="Threads 截圖預覽"
              sx={{
                display: "block",
                width: "100%",
                maxHeight: { xs: 520, md: 720 },
                objectFit: "contain",
              }}
            />
          </CardContent>
          <CardActions
            sx={{
              justifyContent: "flex-end",
              gap: 1,
              p: 2,
              flexWrap: "wrap",
            }}
          >
            <Button startIcon={<OpenInNewIcon />} onClick={handleOpenImage}>
              開新分頁
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
            >
              下載 PNG
            </Button>
          </CardActions>
        </Card>
      )}
    </Stack>
  );
}
