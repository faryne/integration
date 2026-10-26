import { useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import { useSyncAVVideo } from "@/apis/av/video_sync.ts";
import type { VideoSyncResult } from "@/apis/av/video_sync.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";

/**
 * 舊資料缺官方番號（maker_no）時取代 MissAV 按鈕：讓使用者觸發後端向 DMM 重抓這部作品。
 * 成功且拿到官方番號時交給頁面換到新網址；失敗（下架、限流、DMM 故障）用 snack 顯示後端訊息
 */
export function VideoSyncButton({
  no,
  onSynced,
}: {
  no: string;
  onSynced: (result: VideoSyncResult) => void;
}) {
  const sync = useSyncAVVideo();
  const [snack, setSnack] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const handleClick = () =>
    sync.mutate(no, {
      onSuccess: (result) => {
        if (!result.maker_no) {
          setSnack({
            message: "DMM 沒有提供這部作品的官方番號",
            severity: "error",
          });
          return;
        }
        onSynced(result);
      },
      onError: (error) =>
        setSnack({
          message: apiErrorMessage(error, "暫時無法同步，請稍後再試"),
          severity: "error",
        }),
    });

  return (
    <>
      <Button
        disabled={sync.isPending}
        onClick={handleClick}
        startIcon={
          sync.isPending ? (
            <CircularProgress color="inherit" size={18} />
          ) : (
            <SyncIcon />
          )
        }
        sx={{ borderRadius: 1.5, px: 2 }}
        variant="outlined"
      >
        {sync.isPending ? "同步中…" : "同步資料"}
      </Button>
      <CustomSnackbar
        message={snack?.message ?? ""}
        onClose={() => setSnack(null)}
        open={!!snack}
        severity={snack?.severity}
      />
    </>
  );
}
