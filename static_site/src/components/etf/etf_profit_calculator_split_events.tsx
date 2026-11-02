import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

// 分割/反分割紀錄的編輯列（附帶前端專用的 id 以利 React key 與刪除操作）
export interface SplitEventRow {
  id: string;
  date: string;
  ratio: number;
  readOnly?: boolean; // 我方資料帶入的紀錄只顯示文字，不能改也不能刪
}

// 比率轉成口語：4 → 1 拆 4；0.1428571429 → 7 合 1
const formatRatio = (ratio: number) =>
  ratio >= 1 ? `1 拆 ${ratio}` : `${Math.round(1 / ratio)} 合 1`;

interface SplitEventsEditorProps {
  rows: SplitEventRow[];
  onChange: (rows: SplitEventRow[]) => void;
}

// 生效日、比率兩欄等寬；手機寬度下一起縮，不會擠出畫面
const fieldSx = { flex: 1, minWidth: 0, maxWidth: 220 };

export function SplitEventsEditor({ rows, onChange }: SplitEventsEditorProps) {
  const updateRow = (id: string, patch: Partial<SplitEventRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        分割 / 反分割紀錄
      </Typography>
      <Stack spacing={1}>
        {rows.map((row) =>
          row.readOnly ? (
            <Typography variant="body2" key={row.id}>
              {row.date} · {formatRatio(row.ratio)}
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center" key={row.id}>
              <TextField
                type="date"
                label="生效日"
                size="small"
                value={row.date}
                onChange={(e) => updateRow(row.id, { date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={fieldSx}
              />
              <TextField
                type="number"
                label="比率"
                size="small"
                value={row.ratio || ""}
                onChange={(e) =>
                  updateRow(row.id, { ratio: Number(e.target.value) })
                }
                sx={fieldSx}
              />
              <IconButton
                color="error"
                size="small"
                onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ),
        )}
        {/* 填法說明放在所有輸入列下方只出現一次；放在欄位的 helperText 會讓兩個欄位一高一低 */}
        {rows.some((row) => !row.readOnly) && (
          <Typography variant="caption" color="text.secondary">
            比率 = 新股數 / 舊股數，例：1 股拆 2 股填 2；5 股合 1 反分割填 0.2
          </Typography>
        )}
      </Stack>
      <Button
        size="small"
        startIcon={<AddCircleOutlineIcon />}
        onClick={() =>
          onChange([...rows, { id: `split-${Date.now()}`, date: "", ratio: 0 }])
        }
        sx={{ mt: 1 }}
      >
        新增分割/反分割紀錄
      </Button>
    </Box>
  );
}
