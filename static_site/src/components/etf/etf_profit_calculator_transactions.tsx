import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  Snackbar,
  DialogTitle,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  emptyTransaction,
  type Transaction,
} from "@/components/etf/etf_profit_calculator_types.ts";
import { TransactionAccordionItem } from "@/components/etf/etf_profit_calculator_transaction_item.tsx";

interface TransactionRecordsEditorProps {
  records: Transaction[];
  onChange: (records: Transaction[]) => void;
  // 有傳入時顯示「儲存交易紀錄」授權按鈕；使用者同意後才會呼叫，實際持久化 (需登入) 由外部提供
  // 每筆 Transaction 為一個購入批次，可以有 0~多筆賣出紀錄 (sells)
  onSaveTransactions?: (records: Transaction[]) => Promise<void> | void;
}

// 階段式介面：可分批輸入多筆購入交易，每筆購入又可以分好幾次賣出，各自獨立計算損益後加總。
// 紀錄可能很長，用 accordion 收合每一筆購入批次，預設只有一筆時展開，多筆時全部收合。
export function TransactionRecordsEditor({
  records,
  onChange,
  onSaveTransactions,
}: TransactionRecordsEditorProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(records.length <= 1 ? records.map((r) => r.id) : []),
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);

  const handleConfirmSave = async () => {
    if (!onSaveTransactions) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSaveTransactions(records);
      setSaveDialogOpen(false);
      setSavedNotice(true);
    } catch {
      setSaveError("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  };

  const updateRecord = (index: number, patch: Partial<Transaction>) => {
    const newRecs = [...records];
    newRecs[index] = { ...newRecs[index], ...patch };
    onChange(newRecs);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addRecord = () => {
    const newRecord = emptyTransaction(Date.now().toString());
    onChange([...records, newRecord]);
    setExpandedIds((prev) => new Set(prev).add(newRecord.id));
  };

  return (
    <Box>
      {records.map((rec, index) => (
        <TransactionAccordionItem
          key={rec.id}
          record={rec}
          expanded={expandedIds.has(rec.id)}
          onToggleExpanded={() => toggleExpanded(rec.id)}
          onChange={(patch) => updateRecord(index, patch)}
          onDelete={() => onChange(records.filter((r) => r.id !== rec.id))}
        />
      ))}
      <Button
        startIcon={<AddCircleOutlineIcon />}
        variant="outlined"
        fullWidth
        onClick={addRecord}
      >
        增加交易紀錄
      </Button>

      {onSaveTransactions && (
        <>
          <Button
            startIcon={<SaveOutlinedIcon />}
            variant="text"
            fullWidth
            sx={{ mt: 1 }}
            onClick={() => setSaveDialogOpen(true)}
          >
            儲存交易紀錄
          </Button>
          <Dialog
            open={saveDialogOpen}
            onClose={() => {
              if (!saving) setSaveDialogOpen(false);
            }}
          >
            <DialogTitle>儲存交易紀錄</DialogTitle>
            <DialogContent>
              <DialogContentText gutterBottom>
                你即將儲存的持股資訊屬於個人財務隱私，請確認以下內容：
              </DialogContentText>
              <DialogContentText component="div" gutterBottom>
                <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
                  <li>
                    儲存範圍：你在此頁面輸入的購買/賣出日期、股數與價格，不包含券商帳號、身分證字號等其他個資。
                  </li>
                  <li>
                    用途：僅用於下次試算時自動帶入，不會用於推薦、廣告或其他分析用途。
                  </li>
                  <li>分享對象：不會提供給第三方，僅與你的帳號綁定保存。</li>
                </Box>
              </DialogContentText>
              {saveError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {saveError}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setSaveDialogOpen(false)}
                disabled={saving}
              >
                取消
              </Button>
              <Button
                variant="contained"
                onClick={() => void handleConfirmSave()}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={16} /> : undefined}
              >
                同意並儲存
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
      <Snackbar
        open={savedNotice}
        autoHideDuration={2200}
        onClose={() => setSavedNotice(false)}
        message="已儲存交易紀錄"
      />
    </Box>
  );
}
