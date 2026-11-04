import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";

import { useSubmitCopyrightClaim } from "@/apis/nekomaid/copyrightClaim.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { copyrightClaimPath } from "@/helpers/nekomaidForbidden.ts";

const MESSAGE_MAX_LENGTH = 2000;

/**
 * 版權申告入口：作品頁麵包屑上畫師名稱、作品名稱旁的小旗子，範圍由入口決定
 * （畫師旁＝整個畫師、作品旁＝只有這件作品），對話框裡不再讓人選範圍。
 * email 與說明都選填，不需登入；送出後給 /copyright-claim/:hash（同一 IP 送出的申告）的連結，
 * 這是申請人唯一的回饋管道。
 */
export function CopyrightClaimIcon({
  site,
  authorId,
  artworkId = "",
  label,
}: {
  site: string;
  authorId: string;
  /** 空字串＝以整個畫師為範圍 */
  artworkId?: string;
  /** 畫師筆名或作品名稱，顯示在提示與對話框裡 */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot：畫面上看不到，只有機器人會填
  const [resultPath, setResultPath] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const submit = useSubmitCopyrightClaim();
  const resultUrl = resultPath ? `${window.location.origin}${resultPath}` : "";
  const scopeLabel = artworkId ? `作品「${label}」` : `${label} 的所有作品`;

  const handleSubmit = () =>
    submit.mutate(
      {
        site,
        author_id: authorId,
        artwork_id: artworkId,
        contact_email: email.trim(),
        message: message.trim(),
        website,
      },
      {
        onSuccess: (result) => setResultPath(copyrightClaimPath(result.hash)),
        onError: (e) => setError(apiErrorMessage(e, "送出失敗，請稍後再試")),
      },
    );

  // 關閉動畫結束後清空，下次開啟是新的表單
  const reset = () => {
    setEmail("");
    setMessage("");
    setWebsite("");
    setResultPath("");
  };

  return (
    <>
      <Tooltip title={`版權申告：${scopeLabel}`}>
        <IconButton
          aria-label={`版權申告：${scopeLabel}`}
          onClick={() => setOpen(true)}
          size="small"
          sx={{ color: "text.secondary", ml: 0.25, p: 0.25 }}
        >
          <FlagOutlinedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={() => setOpen(false)}
        open={open}
        slotProps={{ transition: { onExited: reset } }}
      >
        {resultPath ? (
          <>
            <DialogContent>
              <Stack alignItems="center" spacing={2} sx={{ pt: 1 }}>
                <CheckCircleOutlineIcon color="success" sx={{ fontSize: 48 }} />
                <Typography fontWeight={800} variant="h6">
                  已收到申告
                </Typography>
                <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
                  <TextField
                    fullWidth
                    size="small"
                    slotProps={{ htmlInput: { readOnly: true } }}
                    value={resultUrl}
                  />
                  <Button
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(resultUrl)
                        .then(() => setCopied(true))
                    }
                    variant="outlined"
                  >
                    複製
                  </Button>
                </Stack>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
              <Button
                component={RouterLink}
                onClick={() => setOpen(false)}
                to={resultPath}
                variant="outlined"
              >
                查看我送出的申告
              </Button>
              <Button onClick={() => setOpen(false)} variant="contained">
                關閉
              </Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle>版權申告</DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                <Typography>申告範圍：{scopeLabel}</Typography>
                <TextField
                  autoComplete="email"
                  label="聯絡 email（選填）"
                  onChange={(e) => setEmail(e.target.value)}
                  size="small"
                  type="email"
                  value={email}
                />
                <TextField
                  label="說明（選填）"
                  minRows={4}
                  multiline
                  onChange={(e) => setMessage(e.target.value)}
                  slotProps={{ htmlInput: { maxLength: MESSAGE_MAX_LENGTH } }}
                  value={message}
                />
                {/* honeypot：移出畫面外、不能 tab 到，正常使用者不會填 */}
                <Box
                  aria-hidden
                  sx={{
                    height: 0,
                    left: -9999,
                    overflow: "hidden",
                    position: "absolute",
                  }}
                >
                  <input
                    autoComplete="off"
                    name="website"
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    value={website}
                  />
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>取消</Button>
              <Button
                disabled={submit.isPending}
                onClick={handleSubmit}
                variant="contained"
              >
                送出
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      <CustomSnackbar
        message={error}
        onClose={() => setError("")}
        open={error !== ""}
        severity="error"
      />
      <CustomSnackbar
        message="已複製"
        onClose={() => setCopied(false)}
        open={copied}
      />
    </>
  );
}
