import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useDiscussionAction,
  useDiscussionThread,
} from "@/apis/storyteller.ts";
import { CommentThreadView } from "@/components/storyteller/comments/CommentThreadView.tsx";
import { useOpenReport } from "@/components/storyteller/report/reportContext.ts";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { PostMarkerText } from "@/components/storyteller/timeline/PostMarkerText.tsx";
import { PostTextInput } from "@/components/storyteller/timeline/PostTextInput.tsx";
import {
  postFullTime,
  postTimeLabel,
} from "@/components/storyteller/timeline/postTime.ts";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { postTextValid } from "@/helpers/postMarkers.ts";
import type { DiscussionThread } from "@/types/storytellerDiscussion.ts";
import {
  discussionThreadLink,
  type ReaderDiscussionContext,
} from "./discussionContext.ts";

type Notify = (message: string, severity?: "success" | "error") => void;
type Confirm = "lock" | "delete" | "block";

// 展開的一串：開頭內文（可編輯）、⋯ 選單（編輯／鎖定／複製連結／檢舉／封鎖發串者／刪除）、整串留言。
export function DiscussionThreadPanel({
  summary,
  context,
  onNotify,
  onLoginRequired,
  onDeleted,
}: {
  summary: DiscussionThread;
  context: ReaderDiscussionContext;
  onNotify: Notify;
  onLoginRequired: () => void;
  onDeleted: () => void;
}) {
  const { data, isLoading } = useDiscussionThread(
    summary.public_id,
    context.share,
  );
  const action = useDiscussionAction(context.share);
  const openReport = useOpenReport();
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(
    null,
  );

  if (isLoading || !data) {
    return <StorytellerLoading label={t("web.discussion.loading")} />;
  }
  const thread = data.thread;
  const starter = thread.author?.pen_name ?? t("web.social.deletedUser");
  const owner = data.viewer;
  const threadId = thread.public_id;
  const fail = (fallback: string) => (error: unknown) =>
    onNotify(apiErrorMessage(error, fallback), "error");
  const run = (
    payload: Parameters<typeof action.mutateAsync>[0],
    success: string,
    after?: () => void,
  ) =>
    action
      .mutateAsync(payload)
      .then(() => {
        onNotify(success);
        after?.();
      })
      .catch(fail(t("web.social.actionFailed")));

  const confirmCopy: Record<
    Confirm,
    { title: string; body: string; ok: string }
  > = {
    lock: {
      title: t("web.discussion.confirm.lockTitle", { title: thread.title }),
      body: t("web.discussion.confirm.lockBody"),
      ok: t("web.discussion.lock"),
    },
    delete: {
      title: t("web.discussion.confirm.deleteTitle"),
      body:
        thread.reply_count > 0
          ? t("web.discussion.confirm.deleteBodyWithReplies", {
              count: thread.reply_count,
            })
          : t("web.discussion.confirm.deleteBody"),
      ok: t("web.common.delete"),
    },
    block: {
      title: t("web.social.blockTitle", { name: starter }),
      body: t("web.discussion.blockDescription"),
      ok: t("web.social.block"),
    },
  };

  function runConfirm() {
    if (!confirm) return;
    if (confirm === "lock")
      void run(
        { type: "lock", threadId, locked: true },
        t("web.discussion.messages.locked"),
        () => setConfirm(null),
      );
    if (confirm === "delete")
      void run(
        { type: "delete", threadId },
        t("web.discussion.messages.deleted"),
        () => {
          setConfirm(null);
          onDeleted();
        },
      );
    if (confirm === "block")
      void run(
        { type: "block-starter", threadId },
        t("web.social.blockedName", { name: starter }),
        () => setConfirm(null),
      );
  }

  return (
    <Box>
      {draft ? (
        <Stack spacing={1} sx={{ px: 2, py: 1.5 }}>
          <TextField
            size="small"
            value={draft.title}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
            inputProps={{ "aria-label": t("web.discussion.fields.title") }}
          />
          <PostTextInput
            value={draft.body}
            onChange={(body) => setDraft({ ...draft, body })}
            placeholder=""
            minRows={4}
            footer={
              <>
                <Button onClick={() => setDraft(null)}>
                  {t("web.common.cancel")}
                </Button>
                <Button
                  variant="contained"
                  disabled={
                    action.isPending ||
                    !draft.title.trim() ||
                    !postTextValid(draft.body)
                  }
                  onClick={() =>
                    void run(
                      { type: "edit", threadId, ...draft },
                      t("web.social.saved"),
                      () => setDraft(null),
                    )
                  }
                >
                  {t("web.common.save")}
                </Button>
              </>
            }
          />
        </Stack>
      ) : (
        <Box sx={{ px: 2, pt: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              variant="caption"
              color="text.disabled"
              title={postFullTime(thread.created_at)}
              sx={{ flex: 1 }}
            >
              {starter} · {postTimeLabel(thread.created_at)}
              {thread.edited && ` · ${t("web.social.edited")}`}
            </Typography>
            <IconButton
              size="small"
              aria-label={t("web.social.moreActions")}
              onClick={(event) => setMenuAnchor(event.currentTarget)}
            >
              <MoreHorizIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Box sx={{ py: 1 }}>
            <PostMarkerText body={thread.body ?? ""} />
          </Box>
        </Box>
      )}
      <CommentThreadView
        comments={data.comments}
        state={owner.state}
        asOptions={owner.as ?? []}
        locked={thread.locked}
        ownerName={t("web.social.author")}
        isOwner={Boolean(thread.can_lock)}
        blockDescription={() => t("web.discussion.blockDescription")}
        placeholder={t("web.social.commentPlaceholder")}
        actions={{
          pending: action.isPending,
          send: (input) =>
            action.mutateAsync({ type: "comment", threadId, input }),
          remove: (commentId) =>
            action.mutateAsync({ type: "delete-comment", commentId }),
          block: (commentId) =>
            action.mutateAsync({ type: "block-commenter", commentId }),
          edit: (commentId, body) =>
            action.mutateAsync({ type: "edit-comment", commentId, body }),
        }}
        onNotify={onNotify}
        onLoginRequired={onLoginRequired}
        share={context.share}
      />
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        {thread.can_edit && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setDraft({ title: thread.title, body: thread.body ?? "" });
            }}
          >
            ✏️ {t("web.common.edit")}
          </MenuItem>
        )}
        {thread.can_lock && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              if (thread.locked)
                void run(
                  { type: "lock", threadId, locked: false },
                  t("web.discussion.messages.unlocked"),
                );
              else setConfirm("lock");
            }}
          >
            {thread.locked
              ? t("web.discussion.unlock")
              : `🔒 ${t("web.discussion.lock")}`}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            void navigator.clipboard
              .writeText(discussionThreadLink(context, threadId))
              .then(() => onNotify(t("web.discussion.messages.linkCopied")))
              .catch(() => onNotify(t("web.social.copyFailed"), "error"));
          }}
        >
          🔗 {t("web.social.copyLink")}
        </MenuItem>
        {!thread.is_mine && (
          <MenuItem
            sx={{ color: "error.main" }}
            onClick={() => {
              setMenuAnchor(null);
              openReport({
                type: "discussion_thread",
                publicId: threadId,
                share: context.share,
                name: thread.title,
              });
            }}
          >
            🚩 {t("moderation.report.menu.action")}
          </MenuItem>
        )}
        {thread.can_block && (
          <MenuItem
            sx={{ color: "error.main" }}
            onClick={() => {
              setMenuAnchor(null);
              setConfirm("block");
            }}
          >
            🚫 {t("web.discussion.blockStarter")}
          </MenuItem>
        )}
        {thread.can_delete && (
          <MenuItem
            sx={{ color: "error.main" }}
            onClick={() => {
              setMenuAnchor(null);
              setConfirm("delete");
            }}
          >
            🗑 {t("web.common.delete")}
          </MenuItem>
        )}
      </Menu>
      <StorytellerMascotDialog
        open={Boolean(confirm)}
        state={confirm === "delete" ? "danger" : "neutral"}
        title={confirm ? confirmCopy[confirm].title : ""}
        description={confirm ? confirmCopy[confirm].body : ""}
        onClose={() => setConfirm(null)}
        actions={
          <>
            <Button onClick={() => setConfirm(null)}>
              {t("web.common.cancel")}
            </Button>
            <Button
              variant="contained"
              color={confirm === "lock" ? "primary" : "error"}
              disabled={action.isPending}
              onClick={runConfirm}
            >
              {confirm ? confirmCopy[confirm].ok : ""}
            </Button>
          </>
        }
      />
    </Box>
  );
}
