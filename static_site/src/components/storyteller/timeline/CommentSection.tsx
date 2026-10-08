import { Box, Button, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTimelineAction } from "@/apis/storyteller.ts";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import type { AuthorPostDetail } from "@/types/storytellerTimeline.ts";
import {
  CommentBox,
  CommentGate,
  type CommentConfirm,
  type ReplyTarget,
} from "./CommentBox.tsx";
import { CommentItem } from "./CommentItem.tsx";

type Notify = (message: string, severity?: "success" | "error") => void;

// 回覆串超過這個數量時，只顯示最後幾則、前面摺起來
const VISIBLE_REPLIES = 2;

// 貼文單頁的留言區：兩層留言串、刪除留佔位、作者封鎖、依 comment_state 顯示留言框或提示。
export function CommentSection({
  detail,
  onNotify,
  onLoginRequired,
}: {
  detail: AuthorPostDetail;
  onNotify: Notify;
  onLoginRequired: () => void;
}) {
  const location = useLocation();
  const action = useTimelineAction();
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<CommentConfirm | null>(null);
  const [flash, setFlash] = useState("");
  const postId = detail.post.public_id;
  const postAuthor = detail.post.author.pen_name;
  const canWrite = detail.comment_state === "ok";

  // 通知連結帶 #c-{id}：捲到那則留言並閃一下；在摺起來的串裡就先展開
  useEffect(() => {
    const id = location.hash.startsWith("#c-") ? location.hash.slice(3) : "";
    if (!id) return;
    const thread = detail.comments.find((c) =>
      c.replies?.some((reply) => reply.public_id === id),
    );
    if (thread) setExpanded((prev) => new Set(prev).add(thread.public_id));
    setFlash(id);
    requestAnimationFrame(() =>
      document.getElementById(`c-${id}`)?.scrollIntoView({ block: "center" }),
    );
  }, [location.hash, detail.comments]);

  function send(body: string, target: ReplyTarget | null, onDone: () => void) {
    action.mutate(
      {
        type: "comment",
        postId,
        input: { body, parent: target?.thread, reply_to: target?.to?.publicId },
      },
      {
        onSuccess: () => {
          onDone();
          onNotify(target ? "已回覆" : "已留言");
        },
        onError: (error) =>
          onNotify(apiErrorMessage(error, "留言失敗，請重試。"), "error"),
      },
    );
  }

  function runConfirm() {
    if (!confirm) return;
    const payload =
      confirm.type === "delete"
        ? ({
            type: "delete-comment",
            commentId: confirm.comment.public_id,
          } as const)
        : ({ type: "block", commentId: confirm.comment.public_id } as const);
    action.mutate(payload, {
      onSuccess: () => {
        onNotify(
          confirm.type === "delete"
            ? "已刪除留言"
            : `已封鎖 ${confirm.comment.author?.pen_name ?? ""}`,
        );
        setConfirm(null);
      },
      onError: (error) =>
        onNotify(apiErrorMessage(error, "操作失敗，請重試。"), "error"),
    });
  }

  const total = detail.post.comment_count;

  return (
    <Box>
      <Typography
        fontWeight={800}
        sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: "divider" }}
      >
        留言 {total}
      </Typography>
      <Box sx={{ px: 2 }}>
        {detail.comments.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ pb: 1.5 }}>
            還沒有人留言。
          </Typography>
        )}
        {detail.comments.map((thread) => {
          const replies = thread.replies ?? [];
          const open =
            expanded.has(thread.public_id) || replies.length <= VISIBLE_REPLIES;
          const shown = open ? replies : replies.slice(-VISIBLE_REPLIES);
          const commentProps = {
            canWrite,
            flash,
            onReply: (target: ReplyTarget) => setReplyTarget(target),
            onConfirm: setConfirm,
          };
          return (
            <Box
              key={thread.public_id}
              sx={{ borderTop: 1, borderColor: "divider", py: 0.5 }}
            >
              <CommentItem
                comment={thread}
                threadId={thread.public_id}
                {...commentProps}
              />
              {!open && (
                <Button
                  size="small"
                  sx={{ ml: 5 }}
                  onClick={() =>
                    setExpanded((prev) => new Set(prev).add(thread.public_id))
                  }
                >
                  ↳ 查看前面 {replies.length - VISIBLE_REPLIES} 則回覆
                </Button>
              )}
              {shown.map((reply) => (
                <CommentItem
                  key={reply.public_id}
                  comment={reply}
                  threadId={thread.public_id}
                  isReply
                  {...commentProps}
                />
              ))}
              {replyTarget?.thread === thread.public_id && (
                <Box sx={{ ml: 5, pb: 1.5 }}>
                  <CommentBox
                    asName={detail.comment_as ?? ""}
                    target={replyTarget}
                    pending={action.isPending}
                    onClearTo={() =>
                      setReplyTarget({ thread: thread.public_id })
                    }
                    onCancel={() => setReplyTarget(null)}
                    onSend={(body, done) =>
                      send(body, replyTarget, () => {
                        done();
                        setReplyTarget(null);
                      })
                    }
                  />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      <Box sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: "divider" }}>
        {detail.comment_state === "ok" ? (
          <CommentBox
            asName={detail.comment_as ?? ""}
            placeholder={
              detail.post.is_owner ? "回應讀者…" : `留言給 ${postAuthor}…`
            }
            pending={action.isPending}
            onSend={(body, done) => send(body, null, done)}
          />
        ) : (
          <CommentGate
            state={detail.comment_state}
            postAuthor={postAuthor}
            onLogin={onLoginRequired}
          />
        )}
      </Box>
      <Box component="span" onClick={(event) => event.stopPropagation()}>
        <StorytellerMascotDialog
          open={Boolean(confirm)}
          state={confirm?.type === "block" ? "neutral" : "danger"}
          eyebrow={confirm?.type === "block" ? "封鎖" : "刪除留言"}
          title={
            confirm?.type === "block"
              ? `封鎖 ${confirm.comment.author?.pen_name ?? "這位使用者"}？`
              : "要刪除這則留言嗎？"
          }
          description={
            confirm?.type === "block"
              ? `對方將不能在 ${postAuthor} 的動態留言或回覆（之後的討論區也一樣），但還是可以看你的動態和作品。對方以前的留言會保留，你可以逐則刪除。這個封鎖只對 ${postAuthor} 這個身份有效，不影響你的其他筆名。`
              : detail.post.is_owner && !confirm?.comment.is_post_author
                ? "這是讀者的留言。你是貼文作者，可以刪除自己貼文底下的任何留言；對方不會收到通知。"
                : "刪除後無法復原，這裡會留下「已刪除」的佔位。"
          }
          onClose={() => setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)}>取消</Button>
              <Button
                color="error"
                variant="contained"
                disabled={action.isPending}
                onClick={runConfirm}
              >
                {confirm?.type === "block" ? "封鎖" : "刪除"}
              </Button>
            </>
          }
        />
      </Box>
    </Box>
  );
}
