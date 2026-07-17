import { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  emptyTransaction,
  type Transaction,
} from "@/components/etf/etf_profit_calculator_types.ts";

interface TransactionRecordsEditorProps {
  records: Transaction[];
  onChange: (records: Transaction[]) => void;
  // 有傳入時顯示「儲存交易紀錄」授權按鈕；使用者同意後才會呼叫，實際持久化 (需登入) 由外部提供
  // 每筆 Transaction 為一個購入批次，若該批次有賣出，賣出資訊會一併帶在同一筆物件內 (buyXxx / sellXxx 同列)，不會拆成獨立的兩筆
  onSaveTransactions?: (records: Transaction[]) => void;
}

// 階段式介面：可分批輸入多筆購入/賣出交易，各自獨立計算損益後加總
export function TransactionRecordsEditor({
  records,
  onChange,
  onSaveTransactions,
}: TransactionRecordsEditorProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const updateRecord = (index: number, patch: Partial<Transaction>) => {
    const newRecs = [...records];
    newRecs[index] = { ...newRecs[index], ...patch };
    onChange(newRecs);
  };

  return (
    <Box>
      {records.map((rec, index) => (
        <Box
          key={rec.id}
          sx={{
            p: 2,
            mb: 2,
            border: "1px solid #f0f0f0",
            borderRadius: 2,
            bgcolor: "#fafafa",
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                type="date"
                label="購入日期"
                size="small"
                value={rec.buyDate}
                onChange={(e) =>
                  updateRecord(index, { buyDate: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
                sx={{ width: 180 }}
              />
              <TextField
                label="原始股數"
                type="number"
                size="small"
                value={rec.buyShares || ""}
                onChange={(e) =>
                  updateRecord(index, { buyShares: Number(e.target.value) })
                }
              />
              <TextField
                label="購入單價"
                type="number"
                size="small"
                value={rec.buyPrice || ""}
                onChange={(e) =>
                  updateRecord(index, { buyPrice: Number(e.target.value) })
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rec.isSold}
                    onChange={(e) =>
                      updateRecord(index, { isSold: e.target.checked })
                    }
                  />
                }
                label="有賣出"
              />
              <IconButton
                color="error"
                onClick={() => onChange(records.filter((r) => r.id !== rec.id))}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Stack>

            {rec.isSold && (
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ pl: 4, py: 1, borderLeft: "3px solid #ffc107" }}
              >
                <Typography
                  variant="body2"
                  color="warning.main"
                  fontWeight="bold"
                >
                  ↳ 賣出：
                </Typography>
                <TextField
                  type="date"
                  label="賣出日期"
                  size="small"
                  value={rec.sellDate}
                  onChange={(e) =>
                    updateRecord(index, { sellDate: e.target.value })
                  }
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 180 }}
                />
                <TextField
                  label="賣出股數"
                  type="number"
                  size="small"
                  value={rec.sellShares || ""}
                  onChange={(e) =>
                    updateRecord(index, { sellShares: Number(e.target.value) })
                  }
                />
                <TextField
                  label="賣出價格"
                  type="number"
                  size="small"
                  value={rec.sellPrice || ""}
                  onChange={(e) =>
                    updateRecord(index, { sellPrice: Number(e.target.value) })
                  }
                />
              </Stack>
            )}
          </Stack>
        </Box>
      ))}
      <Button
        startIcon={<AddCircleOutlineIcon />}
        variant="outlined"
        fullWidth
        onClick={() =>
          onChange([...records, emptyTransaction(Date.now().toString())])
        }
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
            onClose={() => setSaveDialogOpen(false)}
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
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSaveDialogOpen(false)}>取消</Button>
              <Button
                variant="contained"
                onClick={() => {
                  onSaveTransactions(records);
                  setSaveDialogOpen(false);
                }}
              >
                同意並儲存
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Box>
  );
}
