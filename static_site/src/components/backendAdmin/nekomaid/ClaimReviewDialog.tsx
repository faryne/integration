import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { siteLabels } from "@/helpers/nekomaid.ts";
import type { CopyrightClaimAdminItem } from "@/types/nekomaidForbidden.ts";

/**
 * 版權申告的核准／駁回：核准的備註選填（內部用）；駁回理由必填，會顯示在公開的處理結果頁
 */
export function ClaimReviewDialog({
  claim,
  approve,
  open,
  loading,
  onClose,
  onSubmit,
}: {
  claim: CopyrightClaimAdminItem | null;
  open: boolean;
  approve: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const missingReason = !approve && note.trim() === "";

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      onClose={onClose}
      open={open && claim !== null}
      slotProps={{ transition: { onExited: () => setNote("") } }}
    >
      <DialogTitle>{approve ? "核准版權申告" : "駁回版權申告"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {claim && (
            <Typography color="text.secondary" variant="body2">
              {siteLabels[claim.site] ?? claim.site}{" "}
              {claim.nickname || claim.author_id}：
              {claim.artwork_id ? `作品 ${claim.artwork_id}` : "整個畫師"}
            </Typography>
          )}
          <TextField
            label={approve ? "備註（選填）" : "駁回理由（申請人看得到）"}
            minRows={3}
            multiline
            onChange={(e) => setNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 255 } }}
            value={note}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          color={approve ? "primary" : "error"}
          disabled={loading || missingReason}
          onClick={() => onSubmit(note.trim())}
          variant="contained"
        >
          {approve ? "核准並從搜尋移除" : "駁回"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
