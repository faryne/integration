import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Dialog,
  IconButton,
  Stack,
  Typography,
  type DialogProps,
} from "@mui/material";
import { useId, type ReactNode } from "react";
import { storytellerDisplayFontFamily } from "@/data/storytellerTheme.ts";

export interface StorytellerDialogProps {
  open: boolean;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  visual?: ReactNode;
  maxWidth?: DialogProps["maxWidth"];
  onClose?: () => void;
}

/** Storyteller Dialog 的共用骨架；以留白取代 Title／Content／Actions 水平分隔線。 */
export function StorytellerDialog({
  open,
  eyebrow,
  title,
  description,
  children,
  actions,
  visual,
  maxWidth = visual ? "md" : "xs",
  onClose,
}: StorytellerDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={maxWidth}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: "rgba(4, 6, 10, 0.66)",
            backdropFilter: "blur(3px)",
          },
        },
        paper: {
          sx: {
            width: visual ? { xs: "calc(100% - 24px)", sm: 700 } : undefined,
            maxHeight: { xs: "calc(100% - 32px)", sm: "calc(100% - 64px)" },
            overflow: "hidden",
            borderRadius: 2,
            boxShadow: "0 28px 90px rgba(0, 0, 0, 0.48)",
          },
        },
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: visual
            ? { xs: "minmax(0, 1fr)", sm: "210px minmax(0, 1fr)" }
            : "minmax(0, 1fr)",
          minHeight: visual ? { sm: 410 } : undefined,
          overflowY: { xs: "auto", sm: "visible" },
        }}
      >
        {visual}
        <Box
          sx={{
            position: "relative",
            display: "flex",
            minWidth: 0,
            flexDirection: "column",
            p: { xs: 3, sm: visual ? "38px 38px 30px" : "34px 36px 28px" },
          }}
        >
          {onClose && (
            <IconButton
              aria-label="關閉"
              onClick={onClose}
              size="small"
              sx={{ position: "absolute", top: 14, right: 14 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
          {eyebrow && (
            <Typography
              variant="overline"
              color="primary.main"
              fontWeight={800}
              sx={{ mb: 0.75, pr: 4, letterSpacing: "0.1em", lineHeight: 1.5 }}
            >
              {eyebrow}
            </Typography>
          )}
          <Typography
            id={titleId}
            component="h2"
            sx={{
              pr: onClose ? 3 : 0,
              fontFamily: storytellerDisplayFontFamily,
              fontSize: { xs: 21, sm: 25 },
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            {title}
          </Typography>
          {description && (
            <Typography
              id={descriptionId}
              color="text.secondary"
              sx={{ mt: 1.5, lineHeight: 1.75 }}
            >
              {description}
            </Typography>
          )}
          {children && <Box sx={{ mt: 2.5 }}>{children}</Box>}
          {actions && (
            <Stack
              direction={{ xs: "column-reverse", sm: "row" }}
              justifyContent="flex-end"
              spacing={1}
              sx={{
                mt: "auto",
                pt: 3.5,
                "& > .MuiButton-root": { minWidth: 96 },
              }}
            >
              {actions}
            </Stack>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
