import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { Button, IconButton, Tooltip } from "@mui/material";

import { useAuth } from "@/components/auth/AuthContext.ts";

interface FavoriteButtonProps {
  favorite: boolean;
  loading?: boolean;
  onToggle: (favorite: boolean) => Promise<unknown>;
  label: string;
  variant?: "icon" | "button";
}

export function FavoriteButton({
  favorite,
  loading = false,
  onToggle,
  label,
  variant = "icon",
}: FavoriteButtonProps) {
  const { session, login, submitting } = useAuth();

  const toggle = async () => {
    if (!session) {
      await login();
      return;
    }
    await onToggle(!favorite);
  };

  if (variant === "button") {
    return (
      <Button
        variant={favorite ? "contained" : "outlined"}
        color={favorite ? "warning" : "inherit"}
        disabled={loading || submitting}
        onClick={() => void toggle()}
        sx={{
          borderColor: favorite ? "warning.dark" : "warning.main",
          color: favorite ? "warning.contrastText" : "warning.dark",
          bgcolor: favorite ? "warning.main" : "#fff3c4",
          "&:hover": {
            borderColor: "warning.dark",
            bgcolor: favorite ? "warning.dark" : "#ffe399",
          },
        }}
      >
        {favorite ? `已收藏${label}` : `加入收藏${label}`}
      </Button>
    );
  }

  return (
    <Tooltip title={favorite ? `取消收藏${label}` : `收藏${label}`}>
      <span>
        <IconButton
          color={favorite ? "warning" : "default"}
          aria-label={favorite ? `取消收藏${label}` : `收藏${label}`}
          disabled={loading || submitting}
          onClick={() => void toggle()}
        >
          {favorite ? <StarIcon /> : <StarBorderIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
