import { Button } from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";

import type { VideoSearchRequest } from "@/apis/av/video_search.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { searchFollowValue } from "@/helpers/joyuSearchFollow.ts";

import { useFollowToggle } from "./useFollowToggle.ts";

/** 影片搜尋頁「追蹤這個搜尋」：把目前的關鍵字與精確條件存成一筆追蹤；只有日期時不顯示 */
export function SearchFollowButton({
  search,
}: {
  search: Partial<VideoSearchRequest>;
}) {
  const value = searchFollowValue(search);
  return value ? <Toggle value={value} /> : null;
}

function Toggle({ value }: { value: string }) {
  const { ready, on, click, error, clearError } = useFollowToggle(
    "search",
    value,
  );
  if (!ready) return null;
  return (
    <>
      <Button
        onClick={(e) => void click(e)}
        size="small"
        startIcon={on ? <FavoriteIcon /> : <FavoriteBorderIcon />}
        variant={on ? "contained" : "outlined"}
      >
        {on ? "已追蹤這個搜尋" : "追蹤這個搜尋"}
      </Button>
      <CustomSnackbar
        message={error}
        onClose={clearError}
        open={!!error}
        severity="error"
      />
    </>
  );
}
