import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonIcon from "@mui/icons-material/Person";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Fragment, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { postTimeLabel } from "@/components/storyteller/timeline/postTime.ts";
import type { DiscussionThread } from "@/types/storytellerDiscussion.ts";
import type { ReaderDiscussionContext } from "./discussionContext.ts";
import { DiscussionThreadPanel } from "./DiscussionThreadPanel.tsx";

type Notify = (message: string, severity?: "success" | "error") => void;

// 討論串列表：作品頁討論分頁與閱讀頁 modal 共用。點一串在原地展開、再點一次收合，同時只展開一串。
// 錨定的話讀者還沒讀完（或錨定的設定還鎖著）時標題摺起來，展開先看到劇透閘門。
export function DiscussionThreadList({
  threads,
  context,
  showAnchor,
  initialExpanded,
  onNotify,
  onLoginRequired,
}: {
  threads: DiscussionThread[];
  context: ReaderDiscussionContext;
  // 閱讀頁 modal 裡錨點都是同一個，不用再標
  showAnchor: boolean;
  initialExpanded?: string;
  onNotify: Notify;
  onLoginRequired: () => void;
}) {
  const [expanded, setExpanded] = useState(initialExpanded ?? "");
  const [passed, setPassed] = useState<Set<string>>(
    new Set(initialExpanded ? [initialExpanded] : []),
  );
  return (
    <Box>
      {threads.map((thread, index) => {
        const masked =
          showAnchor &&
          thread.anchor &&
          context.isSpoiler(thread.anchor) &&
          !passed.has(thread.public_id);
        const open = expanded === thread.public_id;
        return (
          <Fragment key={thread.public_id}>
            {index > 0 && <Divider />}
            <ThreadRow
              thread={thread}
              context={context}
              showAnchor={showAnchor}
              masked={Boolean(masked)}
              open={open}
              onToggle={() => setExpanded(open ? "" : thread.public_id)}
            />
            {open && (
              <Box
                sx={{
                  borderTop: 1,
                  borderColor: "divider",
                  borderStyle: "dashed",
                  bgcolor: "action.hover",
                }}
              >
                {masked ? (
                  <SpoilerGate
                    label={context.anchorLabel(thread.anchor!)}
                    href={context.anchorHref(thread.anchor!)}
                    onPass={() =>
                      setPassed((prev) => new Set(prev).add(thread.public_id))
                    }
                  />
                ) : (
                  <DiscussionThreadPanel
                    summary={thread}
                    context={context}
                    onNotify={onNotify}
                    onLoginRequired={onLoginRequired}
                    onDeleted={() => setExpanded("")}
                  />
                )}
              </Box>
            )}
          </Fragment>
        );
      })}
    </Box>
  );
}

function ThreadRow({
  thread,
  context,
  showAnchor,
  masked,
  open,
  onToggle,
}: {
  thread: DiscussionThread;
  context: ReaderDiscussionContext;
  showAnchor: boolean;
  masked: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter") onToggle();
      }}
      sx={{
        display: "grid",
        gridTemplateColumns: showAnchor
          ? "34px minmax(0, 1fr) auto"
          : "minmax(0, 1fr) auto",
        gap: 1.5,
        alignItems: "center",
        px: 2,
        py: 1.5,
        cursor: "pointer",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      {showAnchor && (
        <Avatar src={thread.author?.avatar_url} sx={{ width: 34, height: 34 }}>
          <PersonIcon fontSize="small" />
        </Avatar>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
        >
          <Typography
            fontWeight={masked ? 600 : 800}
            fontStyle={masked ? "italic" : undefined}
            color={masked ? "text.secondary" : undefined}
            sx={{ overflowWrap: "anywhere" }}
          >
            {masked ? "尚未讀完的內容" : thread.title}
          </Typography>
          {thread.locked && (
            <Chip
              size="small"
              variant="outlined"
              label="🔒 已鎖定"
              sx={{ height: 20 }}
            />
          )}
          {open ? (
            <ExpandLessIcon fontSize="small" color="disabled" />
          ) : (
            <ExpandMoreIcon fontSize="small" color="disabled" />
          )}
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
          sx={{ mt: 0.25 }}
        >
          {showAnchor && thread.anchor && (
            <Chip
              size="small"
              variant="outlined"
              color={thread.anchor.type === "story" ? "primary" : "secondary"}
              label={context.anchorLabel(thread.anchor)}
              sx={{ height: 20 }}
            />
          )}
          <Typography variant="caption" color="text.secondary">
            {thread.author?.pen_name ?? "已不存在的使用者"}
          </Typography>
          {thread.is_project_author && (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label="作者"
              sx={{ height: 18 }}
            />
          )}
          {thread.blocked && (
            <Chip
              size="small"
              color="error"
              variant="outlined"
              label="已封鎖"
              sx={{ height: 18 }}
            />
          )}
          <Typography variant="caption" color="text.disabled">
            · 最後回覆 {postTimeLabel(thread.last_activity_at)}
          </Typography>
        </Stack>
      </Box>
      <Box sx={{ textAlign: "right", color: "text.secondary" }}>
        <Typography fontWeight={800} color="text.primary">
          {thread.reply_count}
        </Typography>
        <Typography variant="caption">回覆</Typography>
      </Box>
    </Box>
  );
}

// 錨定內容還沒讀完：可以先去讀，或直接看（只在這次瀏覽有效）
function SpoilerGate({
  label,
  href,
  onPass,
}: {
  label: string;
  href?: string;
  onPass: () => void;
}) {
  return (
    <Box
      sx={(theme) => ({
        m: 2,
        p: 2,
        borderRadius: 1.5,
        border: `2px solid ${theme.palette.warning.main}`,
        bgcolor: alpha(theme.palette.warning.main, 0.08),
      })}
    >
      <Typography fontWeight={800}>這串在討論「{label}」</Typography>
      <Typography variant="body2" color="text.secondary">
        你還沒讀完這部分。
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        {href && (
          <Button variant="contained" component={RouterLink} to={href}>
            先去讀
          </Button>
        )}
        <Button variant="outlined" onClick={onPass}>
          直接看
        </Button>
      </Stack>
    </Box>
  );
}
