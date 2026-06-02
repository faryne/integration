import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Link,
  Pagination,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCreateWebshot, useWebshotHistory } from "@/apis/tools/webshot.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import type { Webshot } from "@/types/webshot.ts";

function cdnAssetUrl(path: string, fallback?: string) {
  const cdnBase = String(import.meta.env.VITE_CDN_BASE ?? "").replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");

  if (cdnBase && cleanPath) {
    return `${cdnBase}/${cleanPath}`;
  }
  return fallback ?? path;
}

function formatTime(input?: string) {
  if (!input) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(input));
}

function isNotFoundError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function WebshotRows({
  data,
  onPreview,
}: {
  data?: Webshot;
  onPreview: (imageUrl: string) => void;
}) {
  if (!data?.history?.length) {
    return (
      <Alert severity="info" variant="outlined">
        目前還沒有截圖紀錄。
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      {data.history.map((item) => {
        const fullImageUrl = cdnAssetUrl(item.full_image_path, item.full_image_url);
        const thumbImageUrl = cdnAssetUrl(item.thumb_image_path, item.thumb_image_url);

        return (
          <Paper key={item.id} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <Box
                component="button"
                type="button"
                onClick={() => onPreview(fullImageUrl)}
                sx={{
                  p: 0,
                  width: { xs: "100%", sm: 180 },
                  aspectRatio: "16 / 10",
                  overflow: "hidden",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  cursor: "zoom-in",
                }}
              >
                <Box
                  component="img"
                  src={thumbImageUrl}
                  alt={data.url}
                  sx={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </Box>
              <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {formatTime(item.created_at)}
                </Typography>
                <Typography noWrap title={fullImageUrl}>
                  {fullImageUrl}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    component="a"
                    href={fullImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    size="small"
                    variant="contained"
                    startIcon={<OpenInNewIcon fontSize="small" />}
                  >
                    開啟原圖
                  </Button>
                  <Tooltip title="複製圖片網址">
                    <IconButton
                      aria-label="複製圖片網址"
                      size="small"
                      onClick={() => navigator.clipboard.writeText(fullImageUrl)}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

export default function WebshotPage() {
  const { hash } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const historyPerPage = 10;
  const create = useCreateWebshot();
  const history = useWebshotHistory(hash, historyPage, historyPerPage);
  useTitle(hash ? "網站截圖歷史" : "網站截圖工具", {
    path: hash ? `/tools/webshot/${hash}` : "/tools/webshot",
    robots: hash ? "noindex, nofollow" : "index, follow",
  });

  const current = useMemo(() => {
    if (!hash && create.data?.data) {
      return create.data.data;
    }
    return history.data?.data;
  }, [create.data, hash, history.data]);

  const submit = () => {
    const targetUrl = hash ? current?.url : url;
    if (!targetUrl) {
      return;
    }

    create.mutate(
      { url: targetUrl },
      {
        onSuccess: (resp) => {
          if (!hash && resp.data?.url_hash) {
            navigate(`/tools/webshot/${resp.data.url_hash}`);
            return;
          }
          setHistoryPage(1);
          queryClient.invalidateQueries({ queryKey: ["webshot", hash] });
        },
      },
    );
  };

  const inputUrl = hash ? current?.url ?? "" : url;
  const canSubmit = Boolean(inputUrl) && !create.isPending && (!hash || Boolean(current?.url));
  const pageLink =
    hash && current
      ? `${typeof window === "undefined" ? "" : window.location.origin}/tools/webshot/${current.url_hash}`
      : "";

  if (hash && history.isError && isNotFoundError(history.error)) {
    return (
      <ErrorPage
        code={404}
        backUrl="/tools/webshot"
        message="找不到這筆網站截圖紀錄。請確認連結是否正確，或回到網站截圖工具重新產生截圖。"
      />
    );
  }

  return (
    <Box sx={{ width: "min(100%, 1100px)", mx: "auto", py: 4, px: { xs: 2, md: 0 } }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 900 }}>
            網站截圖工具
          </Typography>
          <Typography color="text.secondary">
            輸入網址後會產生完整頁面截圖、縮圖與歷史頁 QR Code。
          </Typography>
        </Stack>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                label="網址"
                placeholder="https://example.com"
                value={inputUrl}
                onChange={(event) => {
                  if (!hash) {
                    setUrl(event.target.value);
                  }
                }}
                fullWidth
                size="small"
                InputProps={{ readOnly: Boolean(hash) }}
              />
              <Button
                variant="contained"
                startIcon={
                  create.isPending ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <PhotoCameraIcon fontSize="small" />
                  )
                }
                disabled={!canSubmit}
                onClick={submit}
                sx={{ minWidth: 140 }}
              >
                產生截圖
              </Button>
            </Stack>

            {create.isError && (
              <Alert severity="error">{create.error.message}</Alert>
            )}
          </Stack>
        </Paper>

        {hash && history.isLoading && <CircularProgress size={28} />}
        {hash && history.isError && (
          <Alert severity="error">
            {history.error.message || "找不到截圖紀錄。"}
          </Alert>
        )}

        {current && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
            <Stack spacing={2}>
              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {current.url}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={`Hash: ${current.url_hash}`} />
                  <Link href={current.url} target="_blank" rel="noreferrer">
                    開啟來源
                  </Link>
                </Stack>
                {pageLink && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      title={pageLink}
                      sx={{ flex: 1, minWidth: 0 }}
                    >
                      本頁連結：{pageLink}
                    </Typography>
                    <Tooltip title="複製本頁連結">
                      <IconButton
                        aria-label="複製本頁連結"
                        size="small"
                        onClick={() => navigator.clipboard.writeText(pageLink)}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                )}
              </Stack>
              <Divider />
              <WebshotRows data={current} onPreview={setPreviewImageUrl} />
              {current.history_last_page > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
                  <Pagination
                    count={current.history_last_page}
                    onChange={(_, page) => setHistoryPage(page)}
                    page={current.history_current_page}
                    shape="rounded"
                    variant="outlined"
                  />
                </Box>
              )}
            </Stack>
          </Paper>
        )}

        <Dialog
          open={Boolean(previewImageUrl)}
          onClose={() => setPreviewImageUrl("")}
          maxWidth="lg"
          fullWidth
        >
          <DialogContent sx={{ p: 0, bgcolor: "#111827" }}>
            {previewImageUrl && (
              <Box
                component="img"
                src={previewImageUrl}
                alt={current?.url ?? "webshot preview"}
                sx={{
                  display: "block",
                  width: "100%",
                  maxHeight: "90vh",
                  objectFit: "contain",
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </Stack>
    </Box>
  );
}
