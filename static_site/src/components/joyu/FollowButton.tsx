import { IconButton, Tooltip } from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";

import type { FollowKind } from "@/apis/av/joyu_me.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";

import { useFollowToggle } from "./useFollowToggle.ts";

/**
 * joyu 的追蹤愛心（女優、發售商、品牌、系列、監督、標籤共用）。
 * 沒登入的人按下去先建立匿名帳號再收藏，不跳登入；放在連結裡也不會觸發連結
 */
export function FollowButton({
  kind,
  value,
  label,
  size = "small",
}: {
  kind: FollowKind;
  value: string;
  // 給 tooltip 與螢幕閱讀器用，例如女優名字
  label?: string;
  size?: "small" | "medium";
}) {
  const { ready, on, click, error, clearError } = useFollowToggle(kind, value);
  if (!ready) return null;
  const text = `${on ? "取消追蹤" : "追蹤"}${label ? ` ${label}` : ""}`;
  const iconSize = size === "small" ? "inherit" : "small";
  return (
    <>
      <Tooltip title={text}>
        <IconButton
          aria-label={text}
          aria-pressed={on}
          onClick={(e) => void click(e)}
          size={size}
          sx={{
            color: on ? "primary.main" : "text.secondary",
            p: size === "small" ? 0.25 : 0.75,
          }}
        >
          {on ? (
            <FavoriteIcon fontSize={iconSize} />
          ) : (
            <FavoriteBorderIcon fontSize={iconSize} />
          )}
        </IconButton>
      </Tooltip>
      <CustomSnackbar
        message={error}
        onClose={clearError}
        open={!!error}
        severity="error"
      />
    </>
  );
}
