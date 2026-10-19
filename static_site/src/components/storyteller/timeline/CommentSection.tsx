import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          t("web.timeline.blockDescription", { name: postAuthor })
        }
        placeholder={
          detail.post.is_owner
            ? t("web.timeline.replyToReaders")
            : t("web.timeline.commentTo", { name: postAuthor })
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
