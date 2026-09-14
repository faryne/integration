import type { SxProps, Theme } from "@mui/material";

export const workspaceDialogPaperSx: SxProps<Theme> = {
  borderRadius: 0,
  border: 1,
  borderColor: "divider",
  bgcolor: "background.paper",
  color: "text.primary",
  backgroundImage: "none",
  boxShadow: (theme) =>
    theme.palette.mode === "dark"
      ? "0 18px 60px rgba(0, 0, 0, 0.45)"
      : "0 18px 60px rgba(55, 53, 47, 0.16)",
};

export const workspaceDialogBackdropSx: SxProps<Theme> = {
  bgcolor: "rgba(0, 0, 0, 0.5)",
  backdropFilter: "blur(3px)",
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
    borderRadius: 0,
    bgcolor: "background.default",
  },
};
