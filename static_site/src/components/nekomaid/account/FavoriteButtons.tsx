import type { MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, IconButton } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";

import { useNekomaidSession } from "@/apis/nekomaid/accountSession.ts";
import {
  artworkKey,
  authorKey,
  useNekomaidFavoriteKeys,
  useToggleNekomaidFavorite,
} from "@/apis/nekomaid/favorites.ts";
import {
  nekomaidAccountEnabled,
  nekomaidLoginPath,
} from "@/helpers/nekomaidAccount.ts";

const pinkSx = {
  bgcolor: "#e91e63",
  borderColor: "#e91e63",
  "&:hover": { bgcolor: "#c2185b" },
};

/**
 * 收藏／追蹤的共用邏輯：沒登入就帶去登入頁（登入後回到這頁），有登入就切換。
 * faryne.dev/nekomaid 不開帳號功能，回傳 null 讓按鈕不顯示
 */
function useFavoriteToggle(
  kind: "authors" | "artworks",
  key: string,
  path: string,
) {
  const session = useNekomaidSession();
  const keys = useNekomaidFavoriteKeys();
  const toggle = useToggleNekomaidFavorite();
  const navigate = useNavigate();
  const location = useLocation();
  if (!nekomaidAccountEnabled()) return null;
  const on = Boolean(keys.data?.[kind].has(key));
  return {
    on,
    onClick: (e: MouseEvent) => {
      // 作品卡片整張是連結，愛心不要觸發換頁
      e.preventDefault();
      e.stopPropagation();
      if (!session) {
        navigate(nekomaidLoginPath(location.pathname + location.search));
        return;
      }
      toggle.mutate({ path, key, on: !on });
    },
  };
}

/** 作品頁：收藏作品 */
export function FavoriteArtworkButton({
  site,
  authorId,
  artworkId,
}: {
  site: string;
  authorId: string;
  artworkId: string;
}) {
  const state = useFavoriteToggle(
    "artworks",
    artworkKey(site, authorId, artworkId),
    `artworks/${site}/${authorId}/${artworkId}`,
  );
  if (!state) return null;
  return (
    <Button
      onClick={state.onClick}
      startIcon={state.on ? <FavoriteIcon /> : <FavoriteBorderIcon />}
      sx={state.on ? pinkSx : undefined}
      variant={state.on ? "contained" : "outlined"}
    >
      {state.on ? "已收藏" : "收藏作品"}
    </Button>
  );
}

/** 作品頁、畫師頁：追蹤畫師 */
export function FollowAuthorButton({
  site,
  authorId,
}: {
  site: string;
  authorId: string;
}) {
  const state = useFavoriteToggle(
    "authors",
    authorKey(site, authorId),
    `authors/${site}/${authorId}`,
  );
  if (!state) return null;
  return (
    <Button
      onClick={state.onClick}
      startIcon={state.on ? <CheckIcon /> : <PersonAddAlt1Icon />}
      sx={state.on ? pinkSx : undefined}
      variant={state.on ? "contained" : "outlined"}
    >
      {state.on ? "已追蹤畫師" : "追蹤畫師"}
    </Button>
  );
}

/** 作品卡片右上角的愛心 */
export function FavoriteHeart({
  site,
  authorId,
  artworkId,
}: {
  site: string;
  authorId: string;
  artworkId: string;
}) {
  const state = useFavoriteToggle(
    "artworks",
    artworkKey(site, authorId, artworkId),
    `artworks/${site}/${authorId}/${artworkId}`,
  );
  if (!state) return null;
  return (
    <IconButton
      aria-label={state.on ? "取消收藏" : "收藏"}
      onClick={state.onClick}
      size="small"
      sx={{
        bgcolor: state.on ? "#fff" : "rgba(0,0,0,0.45)",
        color: state.on ? "#e91e63" : "#fff",
        position: "absolute",
        right: 8,
        top: 8,
        zIndex: 1,
        "&:hover": { bgcolor: state.on ? "#fff" : "rgba(0,0,0,0.6)" },
      }}
    >
      {state.on ? (
        <FavoriteIcon fontSize="small" />
      ) : (
        <FavoriteBorderIcon fontSize="small" />
      )}
    </IconButton>
  );
}
