import type { SxProps, Theme } from "@mui/material";

export const workspaceDialogPaperSx: SxProps<Theme> = {
  borderRadius: 1,
  border: 1,
  borderColor: (theme) =>
    theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
  bgcolor: (theme) => (theme.palette.mode === "dark" ? "#202020" : "#ffffff"),
  color: (theme) => (theme.palette.mode === "dark" ? "#f1f1f0" : "#37352f"),
  backgroundImage: "none",
  boxShadow: (theme) =>
    theme.palette.mode === "dark"
      ? "0 18px 60px rgba(0, 0, 0, 0.45)"
      : "0 18px 60px rgba(55, 53, 47, 0.16)",
};

export const workspaceDialogBackdropSx: SxProps<Theme> = {
  bgcolor: (theme) =>
    theme.palette.mode === "dark"
      ? "rgba(0, 0, 0, 0.56)"
      : "rgba(55, 53, 47, 0.22)",
};

export const workspaceDialogTitleSx: SxProps<Theme> = {
  px: 2.5,
  pt: 2.25,
  pb: 0.75,
  fontSize: 18,
  fontWeight: 800,
};

export const workspaceDialogContentSx: SxProps<Theme> = {
  px: 2.5,
  py: 1,
};

export const workspaceDialogActionsSx: SxProps<Theme> = {
  px: 2.5,
  pt: 1,
  pb: 2.25,
  gap: 1,
};

export const workspaceTextFieldSx: SxProps<Theme> = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 1,
    bgcolor: (theme) => (theme.palette.mode === "dark" ? "#191919" : "#f7f7f5"),
  },
};
