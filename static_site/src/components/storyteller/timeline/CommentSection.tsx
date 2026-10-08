import { Box } from "@mui/material";
import { useTimelineAction } from "@/apis/storyteller.ts";
import {
  CommentCountHeader,
  CommentThreadView,
} from "@/components/storyteller/comments/CommentThreadView.tsx";
import {
  COMMENT_MAX_LENGTH,
  type AuthorPostDetail,
} from "@/types/storytellerTimeline.ts";

type Notify = (message: string, severity?: "success" | "error") => void;

// 貼文單頁的留言區：畫面是共用的 CommentThreadView，這裡只接動態的 API 與文案。
export function CommentSection({
  detail,
  onNotify,
  onLoginRequired,
}: {
  detail: AuthorPostDetail;
  onNotify: Notify;
  onLoginRequired: () => void;
}) {
  const action = useTimelineAction();
  const postId = detail.post.public_id;
  const postAuthor = detail.post.author.pen_name;
  return (
    <Box>
      <CommentCountHeader count={detail.post.comment_count} />
      <CommentThreadView
        comments={detail.comments}
        state={detail.comment_state}
        asOptions={detail.comment_as ? [detail.comment_as] : []}
        ownerName={postAuthor}
        isOwner={detail.post.is_owner}
        blockDescription={() =>
          `對方將不能在 ${postAuthor} 的動態與作品討論版留言或回覆，但還是可以看你的動態和作品。對方以前的留言會保留，你可以逐則刪除。這個封鎖只對 ${postAuthor} 這個身份有效，不影響你的其他筆名。`
        }
        placeholder={
          detail.post.is_owner ? "回應讀者…" : `留言給 ${postAuthor}…`
        }
        maxLength={COMMENT_MAX_LENGTH}
        actions={{
          pending: action.isPending,
          send: (input) =>
            action.mutateAsync({ type: "comment", postId, input }),
          remove: (commentId) =>
            action.mutateAsync({ type: "delete-comment", commentId }),
          block: (commentId) =>
            action.mutateAsync({ type: "block", commentId }),
        }}
        onNotify={onNotify}
        onLoginRequired={onLoginRequired}
      />
    </Box>
  );
}
