import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import {
  alpha,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import {
  CUSTOM_SNS_TYPE,
  newSnsRow,
  SNS_TYPE_OPTIONS,
  snsUrlError,
  type SNSLinkRow,
} from "@/helpers/storytellerSnsLinks.ts";

// 選取狀態要一眼看得出來（暗色模式下 MUI 預設的選取底色太淡）：公開＝綠色、僅自己＝中性色加粗
const toggleBaseSx: SxProps<Theme> = { gap: 0.5, whiteSpace: "nowrap" };
const publicToggleSx: SxProps<Theme> = {
  ...toggleBaseSx,
  "&.Mui-selected, &.Mui-selected:hover": {
    color: "success.main",
    bgcolor: (theme) => alpha(theme.palette.success.main, 0.18),
    fontWeight: 700,
  },
};
const privateToggleSx: SxProps<Theme> = {
  ...toggleBaseSx,
  "&.Mui-selected, &.Mui-selected:hover": {
    color: "text.primary",
    bgcolor: (theme) => alpha(theme.palette.text.primary, 0.16),
    fontWeight: 700,
  },
};

// SNS 連結編輯器：「我的檔案」與「額外筆名」對話框共用。每一列可以切「公開／僅自己」，
// 僅自己的連結不會出現在公開作者頁、作品作者欄、追蹤清單（後端 PublicSNSLinks 過濾）。
export function StorytellerSnsLinksEditor({
  rows,
  onChange,
  compact = false,
}: {
  rows: SNSLinkRow[];
  onChange: (rows: SNSLinkRow[]) => void;
  // compact：對話框裡空間窄，一律直排、按鈕縮小
  compact?: boolean;
}) {
  const update = (id: string, changes: Partial<SNSLinkRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  return (
    <Stack spacing={1.5}>
      {rows.map((row) => (
        <Stack
          key={row.id}
          direction={compact ? "column" : { xs: "column", sm: "row" }}
          spacing={1}
          alignItems={compact ? "stretch" : { xs: "stretch", sm: "center" }}
          sx={
            compact
              ? { pb: 1, borderBottom: 1, borderColor: "divider" }
              : undefined
          }
        >
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <FormControl
              size={compact ? "small" : "medium"}
              sx={{ minWidth: 150 }}
            >
              <InputLabel>類型</InputLabel>
              <Select
                label="類型"
                value={row.type}
                onChange={(event) =>
                  update(row.id, { type: event.target.value })
                }
              >
                {SNS_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
                <MenuItem value={CUSTOM_SNS_TYPE}>自訂類型</MenuItem>
              </Select>
            </FormControl>
            {row.type === CUSTOM_SNS_TYPE && (
              <TextField
                size={compact ? "small" : "medium"}
                label="自訂類型名稱"
                value={row.customLabel}
                onChange={(event) =>
                  update(row.id, { customLabel: event.target.value })
                }
                sx={{ minWidth: 140 }}
              />
            )}
          </Stack>
          <TextField
            size={compact ? "small" : "medium"}
            label="網址"
            value={row.url}
            onChange={(event) => update(row.id, { url: event.target.value })}
            error={Boolean(snsUrlError(row.type, row.url))}
            helperText={snsUrlError(row.type, row.url)}
            fullWidth
          />
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ flexShrink: 0 }}
          >
            <ToggleButtonGroup
              size="small"
              exclusive
              value={row.isPrivate ? "private" : "public"}
              onChange={(_, value: "public" | "private" | null) => {
                if (value) update(row.id, { isPrivate: value === "private" });
              }}
              aria-label="這個連結的可見性"
            >
              <ToggleButton value="public" sx={publicToggleSx}>
                <PublicIcon fontSize="small" />
                公開
              </ToggleButton>
              <ToggleButton value="private" sx={privateToggleSx}>
                <LockOutlinedIcon fontSize="small" />
                僅自己
              </ToggleButton>
            </ToggleButtonGroup>
            <IconButton
              aria-label="刪除這個 SNS 連結"
              onClick={() =>
                onChange(rows.filter((item) => item.id !== row.id))
              }
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>
      ))}
      <Button
        variant="outlined"
        size={compact ? "small" : "medium"}
        startIcon={<AddIcon />}
        onClick={() => onChange([...rows, newSnsRow()])}
        sx={{ alignSelf: "flex-start" }}
      >
        新增一列
      </Button>
      <Typography variant="caption" color="text.secondary">
        設成「僅自己」的連結不會出現在公開作者頁、作品作者欄與追蹤清單。
      </Typography>
    </Stack>
  );
}
