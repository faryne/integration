import { useState } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import type { useCopyrightClaimForm } from "@/components/nekomaid/useCopyrightClaimForm.ts";

// 版權申告表單的共用零件：作品頁麵包屑的小旗子（對話框）與頁尾的版權申告頁共用；狀態在 useCopyrightClaimForm.ts
const MESSAGE_MAX_LENGTH = 2000;

type ClaimForm = ReturnType<typeof useCopyrightClaimForm>;

/** email、說明、honeypot 三個欄位 */
export function CopyrightClaimFields({ form }: { form: ClaimForm }) {
  return (
    <>
      <TextField
        autoComplete="email"
        label="聯絡 email（選填）"
        onChange={(e) => form.setEmail(e.target.value)}
        size="small"
        type="email"
        value={form.email}
      />
      <TextField
        label="說明（選填）"
        minRows={4}
        multiline
        onChange={(e) => form.setMessage(e.target.value)}
        slotProps={{ htmlInput: { maxLength: MESSAGE_MAX_LENGTH } }}
        value={form.message}
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
          onChange={(e) => form.setWebsite(e.target.value)}
          tabIndex={-1}
          value={form.website}
        />
      </Box>
      <CustomSnackbar
        message={form.error}
        onClose={form.clearError}
        open={form.error !== ""}
        severity="error"
      />
    </>
  );
}

/** 送出成功：給查詢網址（可複製）；這是申請人唯一的回饋管道 */
export function CopyrightClaimDone({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${path}`;
  return (
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
          value={url}
        />
        <Button
          onClick={() =>
            void navigator.clipboard.writeText(url).then(() => setCopied(true))
          }
          variant="outlined"
        >
          複製
        </Button>
      </Stack>
      <CustomSnackbar
        message="已複製"
        onClose={() => setCopied(false)}
        open={copied}
      />
    </Stack>
  );
}
