import { useState } from "react";
import axios from "axios";
import { Button, CircularProgress } from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import { useSyncAVVideo } from "@/apis/av/video_sync.ts";
import type { VideoSyncResult } from "@/apis/av/video_sync.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";

/**
 * 舊資料缺官方番號（maker_no）時取代 MissAV 按鈕：讓使用者觸發後端向 DMM 重抓這部作品。
 * - 成功：交給頁面確認新網址查得到資料再換頁，確認期間按鈕維持「同步中…」
 * - 確定失敗（後端回 404，已標成 orphan）：通知頁面重新查詢，之後 orphan 就不再顯示按鈕
 * - 其他失敗（限流、DMM 故障）：只用 snack 顯示後端訊息，按鈕保留讓使用者稍後再試
 * snack 不跟著按鈕卸載，orphan 隱藏按鈕後錯誤訊息仍然看得到
 */
export function VideoSyncButton({
  no,
  orphan,
  onOrphaned,
  onSynced,
}: {
  no: string;
  orphan: boolean;
  onOrphaned: () => void;
  onSynced: (result: VideoSyncResult) => Promise<void>;
}) {
  const sync = useSyncAVVideo();
  const [confirming, setConfirming] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const busy = sync.isPending || confirming;

  const handleClick = () =>
    sync.mutate(no, {
      onSuccess: async (result) => {
        setConfirming(true);
        try {
          await onSynced(result);
        } catch (error) {
          setSnack(apiErrorMessage(error, "暫時無法同步，請稍後再試"));
        } finally {
          setConfirming(false);
        }
      },
      onError: (error) => {
        setSnack(apiErrorMessage(error, "暫時無法同步，請稍後再試"));
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          onOrphaned();
        }
      },
    });

  return (
    <>
      {!orphan && (
        <Button
          disabled={busy}
          onClick={handleClick}
          startIcon={
            busy ? <CircularProgress color="inherit" size={18} /> : <SyncIcon />
          }
          sx={{ borderRadius: 1.5, px: 2 }}
          variant="outlined"
        >
          {busy ? "同步中…" : "同步資料"}
        </Button>
      )}
      <CustomSnackbar
        message={snack ?? ""}
        onClose={() => setSnack(null)}
        open={!!snack}
        severity="error"
      />
    </>
  );
}
