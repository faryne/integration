import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  Stack,
  Typography,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import {
  emptyTransaction,
  type Transaction,
} from "@/components/etf/etf_profit_calculator_types.ts";
import { TransactionAccordionItem } from "@/components/etf/etf_profit_calculator_transaction_item.tsx";
import { hasRecordError } from "@/components/etf/etf_profit_calculator_validation.ts";

interface TransactionRecordsEditorProps {
  records: Transaction[];
  onChange: (records: Transaction[]) => void;
  // 有傳入時顯示「儲存交易紀錄」授權按鈕；使用者同意後才會呼叫，實際持久化 (需登入) 由外部提供
  // 每筆 Transaction 為一個購入批次，可以有 0~多筆賣出紀錄 (sells)
  onSaveTransactions?: (records: Transaction[]) => Promise<void> | void;
}

type SortDirection = "asc" | "desc";

// 未設定購入日期的紀錄（例如剛新增還沒填的空白列）一律排到最後，方便編輯
function sortByBuyDate(
  records: Transaction[],
  direction: SortDirection,
): Transaction[] {
  return [...records].sort((a, b) => {
    if (!a.buyDate && !b.buyDate) return 0;
    if (!a.buyDate) return 1;
    if (!b.buyDate) return -1;
    return direction === "asc"
      ? a.buyDate.localeCompare(b.buyDate)
      : b.buyDate.localeCompare(a.buyDate);
  });
}

// 階段式介面：可分批輸入多筆購入交易，每筆購入又可以分好幾次賣出，各自獨立計算損益後加總。
// 紀錄可能很長，除了每筆購入批次各自用 accordion 收合外，整份清單外面再包一層
// accordion，方便使用者輸入完直接收起整區塊，不用一直往下捲才能看到試算結果。
// 每筆購入批次預設只有一筆時展開，多筆時全部收合。
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
    // 新增時把其他已展開的紀錄收起來，只留新增的這筆，讓使用者專注在當前輸入
    setExpandedIds(new Set([newRecord.id]));
  };

  // 排序會直接改動實際的交易紀錄順序（不只是畫面顯示），這樣儲存時存下的就是排序後的順序，
  // 也方便在填寫賣出紀錄時，依購入日期新舊快速找到要處分的那筆庫存。
  const handleSort = (direction: SortDirection) => {
    onChange(sortByBuyDate(records, direction));
  };

  const hasErrors = records.some(hasRecordError);

  return (
    <Accordion defaultExpanded variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">
          交易紀錄（共 {records.length} 筆）
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box>
          <Stack
            direction="row"
            justifyContent="flex-end"
            alignItems="center"
            spacing={1}
            sx={{ mb: 1 }}
          >
            <Typography variant="caption" color="text.secondary">
              依購入日期排序：
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowUpwardIcon fontSize="small" />}
              onClick={() => handleSort("asc")}
            >
              舊到新
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowDownwardIcon fontSize="small" />}
              onClick={() => handleSort("desc")}
            >
              新到舊
            </Button>
          </Stack>
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
                disabled={hasErrors}
              >
                儲存交易紀錄
              </Button>
              {hasErrors && (
                <Typography
                  variant="caption"
                  color="error"
                  component="p"
                  align="center"
                  sx={{ mt: 0.5 }}
                >
                  有交易紀錄尚未修正（賣出股數超過購入股數，或賣出日期早於購入日期），請先修正後再儲存
                </Typography>
              )}
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
                      <li>
                        分享對象：不會提供給第三方，僅與你的帳號綁定保存。
                      </li>
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
                    disabled={saving || hasErrors}
                    startIcon={
                      saving ? <CircularProgress size={16} /> : undefined
                    }
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
      </AccordionDetails>
    </Accordion>
  );
}
