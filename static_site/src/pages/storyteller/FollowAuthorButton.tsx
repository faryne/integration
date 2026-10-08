import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import { Button } from "@mui/material";
import { useState } from "react";
import {
  useSaveStorytellerAuthorFavorite,
  useStorytellerAuthorFavorite,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";

// 作者頁／閱讀頁共用的追蹤按鈕。三種狀態：
//   - 本人身份已追蹤：「已追蹤」，點擊取消本人那一筆
//   - 只以筆名追蹤（例如從通知回追）：「已以 P 追蹤」，點擊跳 confirm、取消筆名那一筆；
//     不提供改用本人追蹤，避免使用者以為沒追到又用本人追一次，把筆名串回本人帳號
//   - 都沒追蹤：「追蹤」，一律以本人身份追蹤
export function FollowAuthorButton({
  penName,
  followerCount,
  showName = false,
  disabled,
  onLoginRequired,
  onNotify,
}: {
  penName: string;
  // 有值才在按鈕文字後面顯示（N）
  followerCount?: number;
  // 按鈕文字帶筆名（閱讀頁）或只寫「作者」（作者頁）
  showName?: boolean;
  disabled: boolean;
  onLoginRequired: () => void;
  onNotify: (message: string, severity?: "success" | "error") => void;
}) {
  const { session } = useAuth();
  const query = useStorytellerAuthorFavorite(disabled ? undefined : penName);
  const save = useSaveStorytellerAuthorFavorite(disabled ? undefined : penName);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const favorited = query.data?.favorited ?? false;
  const followingAs = favorited ? [] : (query.data?.following_as ?? []);
  const target = showName ? ` ${penName}` : "作者";
  const count = followerCount === undefined ? "" : `（${followerCount}）`;

  const label = favorited
    ? `已追蹤${target}`
    : followingAs.length > 0
      ? `已以 ${followingAs.join("、")} 追蹤`
      : `追蹤${target}`;

  // 同時以多個筆名追蹤時一次全部取消
  const unfollowPenNames = async () => {
    setConfirmOpen(false);
    try {
      for (const as of followingAs) await save.mutateAsync({ as });
      onNotify(`已取消以 ${followingAs.join("、")} 追蹤`);
    } catch {
      onNotify("取消追蹤失敗，請稍後再試。", "error");
    }
  };

  return (
    <>
      <Button
        variant={favorited || followingAs.length > 0 ? "contained" : "outlined"}
        startIcon={
          favorited || followingAs.length > 0 ? (
            <BookmarkAddedIcon />
          ) : (
            <BookmarkAddIcon />
          )
        }
        disabled={disabled || save.isPending}
        onClick={() => {
          if (!session) {
            onLoginRequired();
            return;
          }
          if (followingAs.length > 0) {
            setConfirmOpen(true);
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
        {label}
        {count}
      </Button>
      <StorytellerMascotDialog
        open={confirmOpen}
        state="neutral"
        eyebrow="取消追蹤"
        title={`要取消以 ${followingAs.join("、")} 追蹤 ${penName} 嗎？`}
        description="你是用筆名追蹤這位作者的，取消後不會改用本人身份追蹤。"
        onClose={() => setConfirmOpen(false)}
        actions={
          <>
            <Button onClick={() => setConfirmOpen(false)}>保留</Button>
            <Button
              variant="contained"
              disabled={save.isPending}
              onClick={() => void unfollowPenNames()}
            >
              取消追蹤
            </Button>
          </>
        }
      />
    </>
  );
}
