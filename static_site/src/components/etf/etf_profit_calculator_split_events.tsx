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
}

interface SplitEventsEditorProps {
  rows: SplitEventRow[];
  onChange: (rows: SplitEventRow[]) => void;
}

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
        {rows.map((row) => (
          <Stack direction="row" spacing={1} alignItems="center" key={row.id}>
            <TextField
              type="date"
              label="生效日"
              size="small"
              value={row.date}
              onChange={(e) => updateRow(row.id, { date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 180 }}
            />
            <TextField
              type="number"
              label="比率 (新股數 / 舊股數)"
              size="small"
              value={row.ratio || ""}
              onChange={(e) =>
                updateRow(row.id, { ratio: Number(e.target.value) })
              }
              helperText="例：1 股拆 2 股填 2；5 股合 1 反分割填 0.2"
              sx={{ width: 240 }}
            />
            <IconButton
              color="error"
              size="small"
              onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
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
