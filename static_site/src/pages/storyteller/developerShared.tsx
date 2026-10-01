import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

// 程式碼／設定區塊加複製按鈕；label 是區塊上方的說明（例如「加到 config.toml」）。
export function CopyableCode({
  value,
  label,
  onCopy,
}: {
  value: string;
  label?: string;
  onCopy: (value: string) => void;
}) {
  return (
    <Box>
      {label && (
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      )}
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box
          component="pre"
          sx={{
            flex: 1,
            minWidth: 0,
            m: 0,
            p: 1.5,
            borderRadius: 1,
            bgcolor: "action.hover",
            fontSize: 12,
            overflowX: "auto",
          }}
        >
          {value}
        </Box>
        <Tooltip title="複製">
          <IconButton size="small" onClick={() => onCopy(value)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

// 「要連哪個工具？」的分段選擇，OAuth 與 Personal Access Token 兩個設定視窗共用。
export function ToolPicker({
  tools,
  value,
  onChange,
}: {
  tools: Array<{ key: string; label: string }>;
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
      {tools.map((tool) => (
        <Chip
          key={tool.key}
          label={tool.label}
          color={tool.key === value ? "primary" : "default"}
          variant={tool.key === value ? "filled" : "outlined"}
          onClick={() => onChange(tool.key)}
        />
      ))}
    </Stack>
  );
}
