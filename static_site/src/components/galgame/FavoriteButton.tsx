import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { alpha, Button, IconButton, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/components/auth/AuthContext.ts";

interface FavoriteButtonProps {
  favorite: boolean;
  loading?: boolean;
  onToggle: (favorite: boolean) => Promise<unknown>;
  // 收藏對象；各語系的整句寫在 galgame.favoriteButton.<kind>.*，不在程式裡拼字
  kind: "brand" | "video";
  variant?: "icon" | "button";
  size?: "small" | "medium";
}

export function FavoriteButton({
  favorite,
  loading = false,
  onToggle,
  kind,
  variant = "icon",
  size = "medium",
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
        color="warning"
        size={size}
        disabled={loading || submitting}
        onClick={() => void toggle()}
        // 未收藏時用半透明的 warning 底色，深淺色模式都看得清楚
        sx={(theme) =>
          favorite
            ? {}
            : {
                color:
                  theme.palette.mode === "dark"
                    ? theme.palette.warning.light
                    : theme.palette.warning.dark,
                bgcolor: alpha(theme.palette.warning.main, 0.12),
                "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.22) },
              }
        }
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
