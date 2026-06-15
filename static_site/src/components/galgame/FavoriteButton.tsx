import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { IconButton, Tooltip } from "@mui/material";

import { useAuth } from "@/components/auth/AuthContext.ts";

interface FavoriteButtonProps {
  favorite: boolean;
  loading?: boolean;
  onToggle: (favorite: boolean) => Promise<unknown>;
  label: string;
}

export function FavoriteButton({
  favorite,
  loading = false,
  onToggle,
  label,
}: FavoriteButtonProps) {
  const { session, login, submitting } = useAuth();

  const toggle = async () => {
    if (!session) {
      await login();
      return;
    }
    await onToggle(!favorite);
  };

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
