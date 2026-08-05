import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Box,
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { useState } from "react";

export interface WorkspaceEditorSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
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
        fontSize: { xs: 36, md: 52 },
        fontWeight: 800,
        lineHeight: 1.12,
        letterSpacing: 0,
        "&::placeholder": { color: "text.disabled" },
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
        fontSize: 16,
        lineHeight: 1.7,
        "&::placeholder": { color: "text.disabled" },
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
  const selected = options.find((option) => option.value === value);
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
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2" color="text.primary" fontWeight={700}>
            {selected?.label ?? "未設定"}
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
