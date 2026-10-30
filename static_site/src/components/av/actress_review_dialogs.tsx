import { useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ActressCandidate } from "@/types/avActressSubmission.ts";

const REJECT_REASONS = [
  "資料來源不可信",
  "與現有女優重複",
  "資料有誤",
  "沒有實質變更",
];

const candidateKey = (c: ActressCandidate) => `${c.domain}-${c.aid}`;

/**
 * 核准確認。sameNames 有值（新增單遇到同名女優）時只能選擇合併到其中一位：
 * 女優頁網址以姓名區分，同名新增會讓其中一位打不開
 */
export function ApproveDialog({
  open,
  message,
  sameNames,
  mergeTarget,
  loading,
  onMergeTargetChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  message: string;
  sameNames: ActressCandidate[];
  mergeTarget: string;
  loading: boolean;
  onMergeTargetChange: (key: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const merging = sameNames.length > 0;
  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>
        {merging ? "核准：已有同名女優" : "核准這張提交單？"}
      </DialogTitle>
      <DialogContent>
        {merging ? (
          <RadioGroup
            onChange={(e) => onMergeTargetChange(e.target.value)}
            value={mergeTarget}
          >
            {sameNames.map((c) => (
              <FormControlLabel
                control={<Radio />}
                key={candidateKey(c)}
                label={
                  <Typography variant="body2">
                    合併到「{c.fields.name}」（{candidateKey(c)}
                    {c.fields.birth_year
                      ? `・${c.fields.birth_year}/${c.fields.birth_month}/${c.fields.birth_day}`
                      : ""}
                    ）
                  </Typography>
                }
                value={candidateKey(c)}
              />
            ))}
            <FormControlLabel
              control={<Radio />}
              disabled
              label={
                <Typography variant="body2">
                  新增為另一位女優（同名時不能選）
                </Typography>
              }
              value="new"
            />
          </RadioGroup>
        ) : (
          <Typography>{message}</Typography>
        )}
        {merging && (
          <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
            有填的欄位覆寫、沒填的保留原值，興趣與參考連結合併。
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          disabled={loading || (merging && !mergeTarget)}
          onClick={onConfirm}
          startIcon={
            loading ? <CircularProgress color="inherit" size={16} /> : undefined
          }
          variant="contained"
        >
          {merging ? "合併並核准" : "核准"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** 否決：常用原因快選＋可自由填寫（選填） */
export function RejectDialog({
  open,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>否決這張提交單？</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {REJECT_REASONS.map((r) => (
              <Chip
                clickable
                color={note === r ? "primary" : "default"}
                key={r}
                label={r}
                onClick={() => setNote(r)}
                size="small"
              />
            ))}
          </Stack>
          <TextField
            label="否決原因（選填）"
            minRows={3}
            multiline
            onChange={(e) => setNote(e.target.value)}
            value={note}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          color="error"
          disabled={loading}
          onClick={() => onConfirm(note)}
          startIcon={
            loading ? <CircularProgress color="inherit" size={16} /> : undefined
          }
          variant="contained"
        >
          否決
        </Button>
      </DialogActions>
    </Dialog>
  );
}
