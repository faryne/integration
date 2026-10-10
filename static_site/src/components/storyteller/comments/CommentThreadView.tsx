import { Box, Button, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import type {
  AuthorPostComment,
  CommentInput,
  CommentViewerState,
} from "@/types/storytellerTimeline.ts";
import {
  CommentBox,
  CommentGate,
  type CommentConfirm,
  type ReplyTarget,
} from "./CommentBox.tsx";
import { CommentItem } from "./CommentItem.tsx";

type Notify = (message: string, severity?: "success" | "error") => void;

// 留言區要做的事，由使用的地方（作者動態／討論串）各自接到自己的 API
export interface CommentActions {
  send: (input: CommentInput) => Promise<unknown>;
  remove: (commentId: string) => Promise<unknown>;
  block: (commentId: string) => Promise<unknown>;
  // 只有討論版可以編輯留言
  edit?: (commentId: string, body: string) => Promise<unknown>;
  pending: boolean;
}

// 回覆串超過這個數量時，只顯示最後幾則、前面摺起來
const VISIBLE_REPLIES = 2;

// 兩層留言串：作者動態與討論串共用同一個畫面——回覆／↪ @、刪除留佔位、作者封鎖、編輯、
// 依發言狀態顯示留言框或提示。通知連結帶 #c-{id} 時捲到那則留言並閃一下。
export function CommentThreadView({
  comments,
  state,
  asOptions,
  locked = false,
  ownerName,
  isOwner,
  blockDescription,
  placeholder,
  maxLength,
  actions,
  onNotify,
  onLoginRequired,
  share,
}: {
  comments: AuthorPostComment[];
  state: CommentViewerState;
  asOptions: string[];
  locked?: boolean;
  // 擁有者的名字：被封鎖提示、刪除確認用
  ownerName: string;
  isOwner: boolean;
  blockDescription: (name: string) => string;
  placeholder: string;
  maxLength?: number;
  actions: CommentActions;
  onNotify: Notify;
  onLoginRequired: () => void;
  // 不公開作品的討論版要帶分享 token，檢舉留言時用
  share?: string;
}) {
  const location = useLocation();
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<CommentConfirm | null>(null);
  const [flash, setFlash] = useState("");
  const canWrite = state === "ok" && !locked;

  useEffect(() => {
    const id = location.hash.startsWith("#c-") ? location.hash.slice(3) : "";
    if (!id) return;
    const thread = comments.find((c) =>
      c.replies?.some((reply) => reply.public_id === id),
    );
    if (thread) setExpanded((prev) => new Set(prev).add(thread.public_id));
    setFlash(id);
    requestAnimationFrame(() =>
      document.getElementById(`c-${id}`)?.scrollIntoView({ block: "center" }),
    );
  }, [location.hash, comments]);

  const fail = (fallback: string) => (error: unknown) =>
    onNotify(apiErrorMessage(error, fallback), "error");

  function send(
    body: string,
    as: string,
    target: ReplyTarget | null,
    onDone: () => void,
  ) {
    actions
      .send({
        body,
        as,
        parent: target?.thread,
        reply_to: target?.to?.publicId,
      })
      .then(() => {
        onDone();
        onNotify(target ? "已回覆" : "已留言");
      })
      .catch(fail("留言失敗，請重試。"));
  }

  function runConfirm() {
    if (!confirm) return;
    const run =
      confirm.type === "delete"
        ? actions.remove(confirm.comment.public_id)
        : actions.block(confirm.comment.public_id);
    run
      .then(() => {
        onNotify(
          confirm.type === "delete"
            ? "已刪除留言"
            : `已封鎖 ${confirm.comment.author?.pen_name ?? ""}`,
        );
        setConfirm(null);
      })
      .catch(fail("操作失敗，請重試。"));
  }

  const itemProps = {
    canWrite,
    flash,
    share,
    maxLength,
    onReply: (target: ReplyTarget) => setReplyTarget(target),
    onConfirm: setConfirm,
    onEdit: actions.edit
      ? (comment: AuthorPostComment, body: string, done: () => void) =>
          actions.edit!(comment.public_id, body)
            .then(() => {
              done();
              onNotify("已儲存");
            })
            .catch(fail("儲存失敗，請重試。"))
      : undefined,
  };

  return (
    <Box>
      <Box sx={{ px: 2 }}>
        {comments.map((thread) => {
          const replies = thread.replies ?? [];
          const open =
            expanded.has(thread.public_id) || replies.length <= VISIBLE_REPLIES;
          const shown = open ? replies : replies.slice(-VISIBLE_REPLIES);
          return (
            <Box
              key={thread.public_id}
              sx={{ borderTop: 1, borderColor: "divider", py: 0.5 }}
            >
              <CommentItem
                comment={thread}
                threadId={thread.public_id}
                {...itemProps}
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
                  {...itemProps}
                />
              ))}
              {canWrite && replyTarget?.thread === thread.public_id && (
                <Box sx={{ ml: 5, pb: 1.5 }}>
                  <CommentBox
                    asOptions={asOptions}
                    target={replyTarget}
                    maxLength={maxLength}
                    pending={actions.pending}
                    onClearTo={() =>
                      setReplyTarget({ thread: thread.public_id })
                    }
                    onCancel={() => setReplyTarget(null)}
                    onSend={(body, as, done) =>
                      send(body, as, replyTarget, () => {
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
        {canWrite ? (
          <CommentBox
            asOptions={asOptions}
            placeholder={placeholder}
            maxLength={maxLength}
            pending={actions.pending}
            onSend={(body, as, done) => send(body, as, null, done)}
          />
        ) : (
          <CommentGate
            state={state}
            ownerName={ownerName}
            locked={locked}
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
              ? blockDescription(confirm.comment.author?.pen_name ?? "對方")
              : isOwner && !confirm?.comment.is_post_author
                ? "這是讀者的留言。你可以刪除自己版面上的任何留言；對方不會收到通知。"
                : "刪除後無法復原，這裡會留下「已刪除」的佔位。"
          }
          onClose={() => setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)}>取消</Button>
              <Button
                color="error"
                variant="contained"
                disabled={actions.pending}
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

// 留言區上方的「留言 N」標題列；動態與討論串共用
export function CommentCountHeader({ count }: { count: number }) {
  return (
    <Typography
      fontWeight={800}
      sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: "divider" }}
    >
      留言 {count}
    </Typography>
  );
}
