import CloseIcon from "@mui/icons-material/Close";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import {
  Badge,
  Box,
  Button,
  Dialog,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDiscussionThreads } from "@/apis/storyteller.ts";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import type { ReaderDiscussionContext } from "./discussionContext.ts";
import { DiscussionThreadList } from "./DiscussionThreadList.tsx";
import { NewDiscussionDialog } from "./NewDiscussionDialog.tsx";
import { useDiscussionFeedback } from "./useDiscussionFeedback.ts";

// 閱讀頁工具列上的「討論」：正文完全不放討論區塊，按了才開 modal（手機全螢幕），
// 列出錨定這一話／這篇設定的討論串，點一串原地展開。關掉回到原本的閱讀位置。
export function ReaderDiscussionButton({
  context,
  anchor,
}: {
  context: ReaderDiscussionContext;
  anchor: { type: "story" | "lore"; id: string; label: string };
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const feedback = useDiscussionFeedback();
  const query = useDiscussionThreads(context.projectPublicId, {
    anchorStory: anchor.type === "story" ? anchor.id : undefined,
    anchorLore: anchor.type === "lore" ? anchor.id : undefined,
    share: context.share,
  });
  const threads = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  const viewer = query.data?.pages[0]?.viewer;

  return (
    <>
      <Tooltip title={t("web.discussion.title")}>
        <Button
          size="small"
          color="inherit"
          aria-label={t("web.discussion.title")}
          onClick={() => setOpen(true)}
          startIcon={
            <Badge badgeContent={total} color="primary" max={99}>
              <ForumOutlinedIcon />
            </Badge>
          }
          sx={{
            minWidth: { xs: 32, sm: "auto" },
            px: { xs: 0.75, sm: 1 },
            "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.5 } },
          }}
        >
          <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
            {t("web.discussion.title")}
          </Box>
        </Button>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { height: fullScreen ? undefined : "86vh" } }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: "divider" }}
        >
          <Typography fontWeight={800} sx={{ flex: 1, minWidth: 0 }} noWrap>
            {t("web.discussion.titleFor", { label: anchor.label })}
          </Typography>
          {viewer && viewer.state !== "blocked" && (
            <Button
              size="small"
              variant="contained"
              onClick={() =>
                viewer.state === "login"
                  ? feedback.askLogin()
                  : setCreating(true)
              }
            >
              {t("web.discussion.create")}
            </Button>
          )}
          <IconButton
            aria-label={t("web.common.close")}
            onClick={() => setOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
        <Box sx={{ flex: 1, overflow: "auto" }}>
          {query.isLoading ? (
            <StorytellerLoading label={t("web.discussion.loading")} />
          ) : threads.length === 0 ? (
            <Typography
              color="text.secondary"
              sx={{ py: 6, textAlign: "center" }}
            >
              {t("web.discussion.empty")}
            </Typography>
          ) : (
            <DiscussionThreadList
              threads={threads}
              context={context}
              showAnchor={false}
              onNotify={feedback.notify}
              onLoginRequired={feedback.askLogin}
            />
          )}
        </Box>
      </Dialog>
      {creating && (
        <NewDiscussionDialog
          open
          context={context}
          anchor={{
            kind: "fixed",
            label: anchor.label,
            story: anchor.type === "story" ? anchor.id : undefined,
            lore: anchor.type === "lore" ? anchor.id : undefined,
          }}
          asOptions={viewer?.as ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => setCreating(false)}
          onNotify={feedback.notify}
        />
      )}
      <LoginPromptDialog
        open={feedback.loginOpen}
        onClose={feedback.closeLogin}
        description={t("web.discussion.loginPrompt")}
      />
      <CustomSnackbar {...feedback.snackProps} />
    </>
  );
}
