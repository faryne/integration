import SendIcon from "@mui/icons-material/Send";
import { Box, IconButton, MenuItem, Paper, Select, Stack, TextField } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// 之後要接的本機 AI CLI；目前只是選單，還沒有偵測安裝與登入狀態
const engines = ["Claude Code", "Codex", "Grok Build"];

// AI 對話分頁：只針對目前這篇文件的討論，版型是對話串＋底部輸入框。
// 目前只有外型，送出還沒接 CLI adapter。
export function ChatPanel() {
  const { t } = useTranslation();
  const [engine, setEngine] = useState(engines[0]);
  const [draft, setDraft] = useState("");
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Box sx={{ flex: 1, overflow: "auto" }} />
      <Box sx={{ px: 2.5, pt: 1.25, pb: 2.25 }}>
        <Paper variant="outlined" sx={{ maxWidth: 780, mx: "auto", px: 1.5, pt: 1.25, pb: 1, borderRadius: 3, "&:focus-within": { borderColor: "primary.main" } }}>
          <TextField
            multiline
            minRows={2}
            maxRows={8}
            fullWidth
            variant="standard"
            placeholder={t("workspace.chat.placeholder")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            slotProps={{ input: { disableUnderline: true, sx: { fontSize: 14 } } }}
          />
          <Stack direction="row" alignItems="center" sx={{ mt: 1 }}>
            <Select size="small" value={engine} onChange={(e) => setEngine(e.target.value)} sx={{ fontSize: 12.5, "& .MuiSelect-select": { py: 0.5 } }}>
              {engines.map((name) => (
                <MenuItem key={name} value={name} sx={{ fontSize: 13 }}>
                  {name}
                </MenuItem>
              ))}
            </Select>
            <Box sx={{ flex: 1 }} />
            <IconButton color="primary" disabled aria-label={t("workspace.chat.send")}>
              <SendIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
