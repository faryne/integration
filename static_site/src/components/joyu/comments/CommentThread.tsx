import { useState } from "react";
import { Box, Button } from "@mui/material";

import { useReplies, type JoyuComment } from "@/apis/av/joyu_comments.ts";

import { CommentComposer } from "./CommentComposer.tsx";
import { CommentItem } from "./CommentItem.tsx";

/**
 * 一則頂層留言＋一層回覆：先顯示最新 3 則回覆，其餘點「顯示全部」再查；
 * 按任何一則的「回覆」都在這串底下開輸入框（回覆別人的回覆時後端會記下 @對象）
 */
export function CommentThread({
  target,
  comment,
}: {
  target: string;
  comment: JoyuComment;
}) {
  const [showAll, setShowAll] = useState(false);
  const [replyTo, setReplyTo] = useState<number>();
  const all = useReplies(comment.id, showAll);
  const replies = (showAll && all.data) || comment.replies || [];
  const hidden = comment.reply_count - replies.length;

  return (
    <Box sx={{ borderBottom: "1px solid", borderColor: "divider", py: 0.5 }}>
      <CommentItem comment={comment} onReply={() => setReplyTo(comment.id)} />
      {(replies.length > 0 || replyTo) && (
        <Box
          sx={{
            borderLeft: "2px solid",
            borderColor: "divider",
            ml: 1.5,
            pb: 1,
            pl: 1.5,
          }}
        >
          {hidden > 0 && (
            <Button
              disabled={all.isFetching}
              onClick={() => setShowAll(true)}
              size="small"
              sx={{ fontSize: 12 }}
            >
              顯示全部 {comment.reply_count} 則回覆
            </Button>
          )}
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              onReply={() => setReplyTo(r.id)}
            />
          ))}
          {replyTo && (
            <CommentComposer
              autoFocus
              onDone={() => setReplyTo(undefined)}
              replyTo={replyTo}
              target={target}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
