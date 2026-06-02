import type { ReactNode } from "react";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  type DialogProps,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ShareIcon from "@mui/icons-material/Share";

export interface DetailDialogProps {
  badge?: string;
  children: ReactNode;
  maxWidth?: DialogProps["maxWidth"];
  onClose: () => void;
  onShare?: () => void;
  open: boolean;
  shareLabel?: string;
  title: ReactNode;
}

export function DetailDialog({
  badge,
  children,
  maxWidth = "md",
  onClose,
  onShare,
  open,
  shareLabel = "分享連結",
  title,
}: DetailDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 48px)",
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle
        sx={{
          m: 0,
          px: 2.5,
          py: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(135deg, #f8fbff 0%, #eef8f4 100%)",
        }}
      >
        <Box>
          {badge && (
            <Chip
              label={badge}
              color="primary"
              size="small"
              sx={{ fontWeight: 900, borderRadius: 1.25, mb: 0.75 }}
            />
          )}
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            {title}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {onShare && (
            <Tooltip title={shareLabel}>
              <IconButton onClick={onShare}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          p: 2.5,
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
