import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";

import {
  CopyrightClaimDone,
  CopyrightClaimFields,
} from "@/components/nekomaid/copyrightClaimForm.tsx";
import { useCopyrightClaimForm } from "@/components/nekomaid/useCopyrightClaimForm.ts";

/**
 * 版權申告入口：作品頁麵包屑上畫師名稱、作品名稱旁的小旗子，範圍由入口決定
 * （畫師旁＝整個畫師、作品旁＝只有這件作品），對話框裡不再讓人選範圍。
 * 表單欄位與送出成功畫面跟頁尾的版權申告頁共用（copyrightClaimForm.tsx）
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
  const form = useCopyrightClaimForm();
  const scopeLabel = artworkId ? `作品「${label}」` : `${label} 的所有作品`;

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
        // 關閉動畫結束後清空，下次開啟是新的表單
        slotProps={{ transition: { onExited: form.reset } }}
      >
        {form.resultPath ? (
          <>
            <DialogContent>
              <CopyrightClaimDone path={form.resultPath} />
            </DialogContent>
            <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
              <Button
                component={RouterLink}
                onClick={() => setOpen(false)}
                to={form.resultPath}
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
                <CopyrightClaimFields form={form} />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>取消</Button>
              <Button
                disabled={form.pending}
                onClick={() => form.submit(site, authorId, artworkId)}
                variant="contained"
              >
                送出
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
