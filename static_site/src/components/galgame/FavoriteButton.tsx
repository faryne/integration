import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { Button, IconButton, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/auth/AuthContext.ts";

interface FavoriteButtonProps {
  favorite: boolean;
  loading?: boolean;
  onToggle: (favorite: boolean) => Promise<unknown>;
  // 收藏對象；各語系的整句寫在 galgame.favoriteButton.<kind>.*，不在程式裡拼字
  kind: "brand" | "video";
  variant?: "icon" | "button";
}

export function FavoriteButton({
  favorite,
  loading = false,
  onToggle,
  kind,
  variant = "icon",
}: FavoriteButtonProps) {
  const { t } = useTranslation();
  const { session, login, submitting } = useAuth();

  const iconLabel = t(
    `galgame.favoriteButton.${kind}.${favorite ? "remove" : "favorite"}`,
  );

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
        {t(`galgame.favoriteButton.${kind}.${favorite ? "added" : "add"}`)}
      </Button>
    );
  }

  return (
    <Tooltip title={iconLabel}>
      <span>
        <IconButton
          color={favorite ? "warning" : "default"}
          aria-label={iconLabel}
          disabled={loading || submitting}
          onClick={() => void toggle()}
        >
          {favorite ? <StarIcon /> : <StarBorderIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
