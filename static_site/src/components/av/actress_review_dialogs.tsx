import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import type { ActressCandidate } from "@/types/avActressSubmission.ts";

const candidateKey = (c: ActressCandidate) => `${c.domain}-${c.aid}`;

// 核准 API 的 merge_target：同名時不合併、新增為另一位
export const MERGE_TARGET_NEW = "new";

/**
 * 核准確認。sameNames 有值（新增單遇到同名女優）時，要選合併到其中一位，或新增為另一位（mergeTarget = "new"），
 * 沒有預設值；女優頁網址帶 xcity_id／manual_id，同名的人各自打得開
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
  const creatingNew = mergeTarget === MERGE_TARGET_NEW;
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
              label={<Typography variant="body2">新增為另一位女優</Typography>}
              value={MERGE_TARGET_NEW}
            />
          </RadioGroup>
        ) : (
          <Typography>{message}</Typography>
        )}
        {merging && !creatingNew && (
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
          {merging && !creatingNew
            ? "合併並核准"
            : merging
              ? "新增並核准"
              : "核准"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
