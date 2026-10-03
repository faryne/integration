import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  ClickAwayListener,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { ReactNode } from "react";
import { useState } from "react";
import { ShortcutHint } from "@/components/common/ShortcutHint.tsx";
import {
  selectedOptionLabel,
  selectedOptionsLabel,
  type WorkspaceEditorSelectOption,
} from "./workspaceEditorOptions.ts";

// 編輯頁的手機版斷點：跟 StoryEditor 工具列的 compact 判斷一致（< sm）
function useWorkspaceEditorCompact() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("sm"));
}

export interface WorkspaceEditorMetaItem {
  icon: ReactNode;
  text: string;
}

// 標題下方的屬性按鈕列＋摘要。手機版收成一行摘要（例如「未公開 · 起源故事 · 本人」），
// 點了才展開成完整的按鈕與摘要，把高度讓給編輯區；桌機直接顯示 children。每次進頁預設收起。
export function WorkspaceEditorMetaPanel({
  items,
  children,
}: {
  items: WorkspaceEditorMetaItem[];
  children: ReactNode;
}) {
  const compact = useWorkspaceEditorCompact();
  const [expanded, setExpanded] = useState(false);
  if (!compact) return <>{children}</>;
  return (
    <Stack spacing={1}>
      <ButtonBase
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        sx={{
          justifyContent: "flex-start",
          gap: 1,
          px: 0.5,
          py: 0.5,
          borderRadius: 1,
          color: "text.secondary",
          textAlign: "left",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
            "& svg": { fontSize: 15 },
          }}
        >
          {items.map((item, index) => (
            <Stack
              key={index}
              direction="row"
              alignItems="center"
              spacing={0.4}
              // 只有長的項目（筆名、冊名）可以被截斷，「公開中」這類短字維持完整
              sx={{ flexShrink: item.text.length > 6 ? 1 : 0, minWidth: 0 }}
            >
              {index > 0 && <Typography variant="caption">·</Typography>}
              {item.icon}
              <Typography
                variant="caption"
                color="text.primary"
                fontWeight={700}
                noWrap
              >
                {item.text}
              </Typography>
            </Stack>
          ))}
        </Stack>
        <Typography
          variant="caption"
          color="primary"
          fontWeight={700}
          sx={{ flexShrink: 0, display: "flex", alignItems: "center" }}
        >
          {expanded ? "收起" : "屬性與摘要"}
          {expanded ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </Typography>
      </ButtonBase>
      {expanded && children}
    </Stack>
  );
}

export interface WorkspaceEditorStatusItem {
  icon: ReactNode;
  // hover／點擊時顯示的完整說明，例如「2,187 字」「每 5 分鐘自動存檔」
  detail: string;
  // success：自動存檔開啟；warning：尚未存檔等需要注意的狀態
  tone?: "success" | "warning";
}

// 字數／更新時間／自動存檔：只放 icon（跟工具列擠同一行），hover／點擊才顯示完整說明；
// 狀態靠 icon 顏色表達（自動存檔開啟綠色、尚未存檔警告色）。
export function WorkspaceEditorStatusInfo({
  items,
}: {
  items: WorkspaceEditorStatusItem[];
}) {
  return (
    <Stack direction="row" alignItems="center" sx={{ minWidth: 0 }}>
      {items.map((item) => (
        <WorkspaceEditorStatusEntry key={item.detail} item={item} />
      ))}
    </Stack>
  );
}

// 單一狀態項目：滑鼠 hover 顯示；觸控點一下顯示、點旁邊關閉
// （MUI Tooltip 在觸控裝置預設要長按，所以關掉它的 touch listener 改用 onClick 開啟）。
function WorkspaceEditorStatusEntry({
  item,
}: {
  item: WorkspaceEditorStatusItem;
}) {
  const [open, setOpen] = useState(false);
  const color =
    item.tone === "warning"
      ? "warning.main"
      : item.tone === "success"
        ? "success.main"
        : "text.secondary";
  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <span>
        <Tooltip
          arrow
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          disableTouchListener
          title={item.detail}
        >
          <ButtonBase
            aria-label={item.detail}
            onClick={() => setOpen(true)}
            sx={{
              p: 0.5,
              borderRadius: 1,
              color,
              "& svg": { fontSize: 18 },
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            {item.icon}
          </ButtonBase>
        </Tooltip>
      </span>
    </ClickAwayListener>
  );
}

// 編輯頁底部的存檔按鈕（故事／設定共用）。桌機在按鈕內直接標出快捷鍵（⌘S／Ctrl+S）；
// 手機只留 icon，讓狀態 icon、工具列、存檔擠得進同一行。
export function WorkspaceEditorSaveButton({
  pending,
  disabled,
  onClick,
}: {
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = pending ? "存檔中" : "存檔";
  return (
    <Button
      size="small"
      variant="contained"
      aria-label={label}
      startIcon={<SaveIcon />}
      disabled={disabled}
      onClick={onClick}
      sx={{
        minWidth: { xs: 36, sm: 88 },
        px: { xs: 1, sm: 1.25 },
        "& .MuiButton-startIcon": { mx: { xs: 0, sm: undefined } },
      }}
    >
      <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
        {label}
        <ShortcutHint shortcutKey="S" />
      </Box>
    </Button>
  );
}

// 嵌入編輯器（故事/圖像/設定集/資產）標題列共用排版——標題（WorkspaceEditableTitle）
// 靠左，字數/更新時間等 chip 與存檔按鈕靠右，同一列顯示，不要疊成兩列。
export function WorkspaceEditorHeaderRow({
  title,
  actions,
}: {
  title: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", sm: "center" }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>{title}</Box>
      {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
    </Stack>
  );
}

export function WorkspaceEditableTitle({
  value,
  placeholder,
  disabled,
  onChange,
}: {
  value: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Box
      component="input"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      sx={{
        width: 1,
        p: 0,
        border: 0,
        outline: 0,
        bgcolor: "transparent",
        color: "text.primary",
        font: "inherit",
        // 手機版縮小，避免標題吃掉編輯區的高度
        fontSize: { xs: 22, sm: 34, md: 44 },
        fontWeight: 800,
        lineHeight: 1.16,
        letterSpacing: 0,
        "&::placeholder": { color: "text.disabled" },
        // a11y：拿掉瀏覽器預設 focus 外框後一定要補一個看得見的替代方案，不能
        // 整個消失（跟 MuiButtonBase 的 focus-visible 處理原則一致）。
        "&:focus-visible": {
          outline: "2px solid var(--storyteller-focus-ring)",
          outlineOffset: 2,
        },
      }}
    />
  );
}

export function WorkspaceEditableSummary({
  value,
  placeholder,
  disabled,
  onChange,
}: {
  value: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Box
      component="textarea"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      rows={2}
      onChange={(event) => onChange(event.target.value)}
      sx={{
        width: 1,
        p: 0,
        border: 0,
        outline: 0,
        resize: "vertical",
        bgcolor: "transparent",
        color: "text.secondary",
        font: "inherit",
        fontSize: 15,
        lineHeight: 1.65,
        "&::placeholder": { color: "text.disabled" },
        "&:focus-visible": {
          outline: "2px solid var(--storyteller-focus-ring)",
          outlineOffset: 2,
        },
      }}
    />
  );
}

export function WorkspaceEditorSelectButton({
  icon,
  label,
  value,
  options,
  disabled,
  onChange,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  options: WorkspaceEditorSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
  children?: ReactNode;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return (
    <Stack spacing={0.75} alignItems="flex-start">
      <Button
        size="small"
        disabled={disabled}
        startIcon={icon}
        endIcon={<ExpandMoreIcon fontSize="small" />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          justifyContent: "flex-start",
          color: "text.secondary",
          borderRadius: 1,
          px: 1,
          minHeight: 30,
          bgcolor: "transparent",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2" color="text.primary" fontWeight={700}>
            {selectedOptionLabel(options, value)}
          </Typography>
        </Stack>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{ dense: true }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === value}
            onClick={() => {
              onChange(option.value);
              setAnchorEl(null);
            }}
          >
            {option.icon && <ListItemIcon>{option.icon}</ListItemIcon>}
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
      {children}
    </Stack>
  );
}

export function WorkspaceEditorMultiSelectButton({
  icon,
  label,
  values,
  options,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  values: string[];
  options: WorkspaceEditorSelectOption[];
  disabled?: boolean;
  onChange: (values: string[]) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return (
    <Stack spacing={0.75} alignItems="flex-start">
      <Button
        size="small"
        disabled={disabled}
        startIcon={icon}
        endIcon={<ExpandMoreIcon fontSize="small" />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          justifyContent: "flex-start",
          color: "text.secondary",
          borderRadius: 1,
          px: 1,
          minHeight: 30,
          bgcolor: "transparent",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2" color="text.primary" fontWeight={700}>
            {selectedOptionsLabel(options, values)}
          </Typography>
        </Stack>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{ dense: true }}
      >
        {options.map((option) => {
          const checked = values.includes(option.value);
          return (
            <MenuItem
              key={option.value}
              selected={checked}
              onClick={() => {
                if (checked) {
                  const next = values.filter((value) => value !== option.value);
                  onChange(next.length === 0 ? [option.value] : next);
                  return;
                }
                onChange([...values, option.value]);
              }}
            >
              <Checkbox size="small" checked={checked} sx={{ p: 0, mr: 1 }} />
              {option.icon && <ListItemIcon>{option.icon}</ListItemIcon>}
              <ListItemText>{option.label}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </Stack>
  );
}
