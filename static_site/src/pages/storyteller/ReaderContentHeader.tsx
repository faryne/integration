import {
  useSaveStorytellerAuthorFavorite,
  useStorytellerAuthorFavorite,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { Ref } from "react";
import { Link as RouterLink } from "react-router-dom";

export function FollowAuthorButton({
  penName,
  followerCount,
  disabled,
  onLoginRequired,
  onNotify,
}: {
  penName: string;
  followerCount: number;
  disabled: boolean;
  onLoginRequired: () => void;
  onNotify: (message: string, severity?: "success" | "error") => void;
}) {
  const { session } = useAuth();
  const query = useStorytellerAuthorFavorite(disabled ? undefined : penName);
  const save = useSaveStorytellerAuthorFavorite(disabled ? undefined : penName);
  const favorited = query.data?.favorited ?? false;
  return (
    <Button
      variant={favorited ? "contained" : "outlined"}
      startIcon={favorited ? <BookmarkAddedIcon /> : <BookmarkAddIcon />}
      disabled={disabled || save.isPending}
      onClick={() => {
        if (!session) {
          onLoginRequired();
          return;
        }
        const next = !favorited;
        save.mutate(next, {
          onSuccess: () =>
            onNotify(next ? `已追蹤 ${penName}` : `已取消追蹤 ${penName}`),
          onError: () => onNotify("作者追蹤狀態更新失敗，請重試。", "error"),
        });
      }}
    >
      {favorited ? `已追蹤 ${penName}` : `追蹤 ${penName}`}（{followerCount}）
    </Button>
  );
}

// 跨內容類型（故事／圖像／未來新增的類型）共用的作品標頭：標題、簡介、作者、
// 最後更新時間。新增內容類型時應該一律沿用這個元件，不要各自刻一份標頭版面。
export function ContentMetaHeader({
  title,
  titleRef,
  summary,
  authorPenNames,
  updatedAt,
}: {
  title: string;
  titleRef?: Ref<HTMLHeadingElement>;
  summary?: string;
  authorPenNames?: string[];
  updatedAt: string;
}) {
  return (
    <Box>
      <Typography
        ref={titleRef}
        component="h1"
        variant="h4"
        fontWeight={800}
        sx={{ scrollMarginTop: 80 }}
      >
        {title}
      </Typography>
      {summary && (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {summary}
        </Typography>
      )}
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        sx={{ mt: 1 }}
      >
        {authorPenNames && authorPenNames.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {authorPenNames.map((penName) => (
              <Typography
                key={penName}
                variant="caption"
                color="primary"
                component={RouterLink}
                to={steamloomPath(`user/${encodeURIComponent(penName)}`)}
                sx={{
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                作者 {penName}
              </Typography>
            ))}
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary">
          更新於 {formatStorytellerDate(updatedAt)}
        </Typography>
      </Stack>
    </Box>
  );
}
