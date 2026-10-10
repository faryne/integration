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
    return <StorytellerLoading label="正在載入討論..." />;
  }
  const thread = data.thread;
  const starter = thread.author?.pen_name ?? "已不存在的使用者";
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
      .catch(fail("操作失敗，請重試。"));

  const confirmCopy: Record<
    Confirm,
    { title: string; body: string; ok: string }
  > = {
    lock: {
      title: `鎖定「${thread.title}」？`,
      body: "鎖定後所有人都無法再回覆這個討論串，已經有的內容仍然看得到。之後可以解除鎖定。",
      ok: "鎖定",
    },
    delete: {
      title: "要刪除這個討論串嗎？",
      body:
        thread.reply_count > 0
          ? `刪除後無法復原，底下 ${thread.reply_count} 則回覆也會一起看不到。`
          : "刪除後無法復原。",
      ok: "刪除",
    },
    block: {
      title: `封鎖 ${starter}？`,
      body: `對方將不能在這部作品的討論版與你這部作品署名身份的動態留言或發起討論，但還是可以閱讀。對方以前的內容會保留，你可以逐則刪除。`,
      ok: "封鎖",
    },
  };

  function runConfirm() {
    if (!confirm) return;
    if (confirm === "lock")
      void run(
        { type: "lock", threadId, locked: true },
        "已鎖定，所有人都無法再回覆",
        () => setConfirm(null),
      );
    if (confirm === "delete")
      void run({ type: "delete", threadId }, "已刪除討論串", () => {
        setConfirm(null);
        onDeleted();
      });
    if (confirm === "block")
      void run({ type: "block-starter", threadId }, `已封鎖 ${starter}`, () =>
        setConfirm(null),
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
            inputProps={{ "aria-label": "標題" }}
          />
          <PostTextInput
            value={draft.body}
            onChange={(body) => setDraft({ ...draft, body })}
            placeholder=""
            minRows={4}
            footer={
              <>
                <Button onClick={() => setDraft(null)}>取消</Button>
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
                      "已儲存",
                      () => setDraft(null),
                    )
                  }
                >
                  儲存
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
              {thread.edited && " · 已編輯"}
            </Typography>
            <IconButton
              size="small"
              aria-label="更多動作"
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
        ownerName="作者"
        isOwner={Boolean(thread.can_lock)}
        blockDescription={() =>
          "對方將不能在這部作品的討論版與你這部作品署名身份的動態留言或發起討論，但還是可以閱讀。對方以前的內容會保留，你可以逐則刪除。"
        }
        placeholder="留言…"
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
            ✏️ 編輯
          </MenuItem>
        )}
        {thread.can_lock && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              if (thread.locked)
                void run(
                  { type: "lock", threadId, locked: false },
                  "已解除鎖定",
                );
              else setConfirm("lock");
            }}
          >
            {thread.locked ? "解除鎖定" : "🔒 鎖定"}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            void navigator.clipboard
              .writeText(discussionThreadLink(context, threadId))
              .then(() => onNotify("已複製討論串連結"))
              .catch(() => onNotify("複製失敗，請手動複製網址列。", "error"));
          }}
        >
          🔗 複製連結
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
            🚫 封鎖發串者
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
            🗑 刪除
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
            <Button onClick={() => setConfirm(null)}>取消</Button>
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
