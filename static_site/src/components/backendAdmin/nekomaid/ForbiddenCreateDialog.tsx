import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";

import { siteLabels } from "@/helpers/nekomaid.ts";
import { parseNekomaidTargetUrl } from "@/helpers/nekomaidForbidden.ts";
import type { NekomaidForbiddenCreateRequest } from "@/types/nekomaidForbidden.ts";

const EMPTY: NekomaidForbiddenCreateRequest = {
  site: "pixiv",
  author_id: "",
  artwork_id: "",
  note: "",
};

/**
 * 後台新增禁抓：貼畫師／作品網址會自動帶入站台與 ID，也可以手填。
 * 作品 ID 留空＝整個畫師；只填作品 ID 時由後端反查畫師。
 * 新增可以再解除（只動 ES），所以不跳 confirm。
 */
export function ForbiddenCreateDialog({
  open,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: NekomaidForbiddenCreateRequest) => void;
}) {
  const [url, setUrl] = useState("");
  const [form, setForm] = useState(EMPTY);
  const set = (patch: Partial<NekomaidForbiddenCreateRequest>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleUrl = (value: string) => {
    setUrl(value);
    const target = parseNekomaidTargetUrl(value);
    if (target) {
      const [site, author_id, artwork_id] = target;
      set({ site, author_id, artwork_id });
    }
  };

  // 關閉後清空，下次開啟是乾淨的表單
  const reset = () => {
    setUrl("");
    setForm(EMPTY);
  };

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      onClose={onClose}
      open={open}
      slotProps={{ transition: { onExited: reset } }}
    >
      <DialogTitle>新增禁抓</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="網址"
            onChange={(e) => handleUrl(e.target.value)}
            placeholder="pixiv／nico／tinami 或 neko.maid.tw 的畫師、作品網址"
            size="small"
            value={url}
          />
          <TextField
            label="來源站"
            onChange={(e) => set({ site: e.target.value })}
            select
            size="small"
            value={form.site}
          >
            {Object.entries(siteLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="畫師 ID"
            onChange={(e) => set({ author_id: e.target.value.trim() })}
            size="small"
            value={form.author_id}
          />
          <TextField
            label="作品 ID（留空＝整個畫師）"
            onChange={(e) => set({ artwork_id: e.target.value.trim() })}
            size="small"
            value={form.artwork_id}
          />
          <TextField
            label="備註"
            onChange={(e) => set({ note: e.target.value })}
            size="small"
            slotProps={{ htmlInput: { maxLength: 255 } }}
            value={form.note}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          disabled={loading || (!form.author_id && !form.artwork_id)}
          onClick={() => onSubmit(form)}
          variant="contained"
        >
          新增
        </Button>
      </DialogActions>
    </Dialog>
  );
}
