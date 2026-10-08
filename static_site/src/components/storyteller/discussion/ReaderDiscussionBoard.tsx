import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Select,
  Stack,
} from "@mui/material";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDiscussionThreads } from "@/apis/storyteller.ts";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog.tsx";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import type {
  DiscussionFilter,
  DiscussionSort,
} from "@/types/storytellerDiscussion.ts";
import type { ReaderDiscussionContext } from "./discussionContext.ts";
import { DiscussionThreadList } from "./DiscussionThreadList.tsx";
import { NewDiscussionDialog } from "./NewDiscussionDialog.tsx";
import { useDiscussionFeedback } from "./useDiscussionFeedback.ts";

const FILTERS: [DiscussionFilter, string][] = [
  ["all", "全部"],
  ["general", "一般"],
  ["story", "故事"],
  ["lore", "設定"],
];

// 作品首頁「討論」分頁：所有討論串，可篩選、排序；網址帶 ?thread= 時自動展開那一串。
export function ReaderDiscussionBoard({
  context,
}: {
  context: ReaderDiscussionContext;
}) {
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<DiscussionFilter>("all");
  const [sort, setSort] = useState<DiscussionSort>("latest");
  const [creating, setCreating] = useState(false);
  const feedback = useDiscussionFeedback();
  const query = useDiscussionThreads(context.projectPublicId, {
    filter,
    sort,
    share: context.share,
  });
  const threads = query.data?.pages.flatMap((page) => page.items) ?? [];
  const viewer = query.data?.pages[0]?.viewer;

  return (
    <Stack spacing={1.5}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        spacing={1}
      >
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {FILTERS.map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              color={filter === value ? "primary" : "default"}
              variant={filter === value ? "filled" : "outlined"}
              onClick={() => setFilter(value)}
            />
          ))}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Select
            size="small"
            value={sort}
            onChange={(event) => setSort(event.target.value as DiscussionSort)}
          >
            <MenuItem value="latest">最新回覆</MenuItem>
            <MenuItem value="newest">最新發起</MenuItem>
          </Select>
          {viewer && viewer.state !== "blocked" && (
            <Button
              variant="contained"
              onClick={() =>
                viewer.state === "login"
                  ? feedback.askLogin()
                  : setCreating(true)
              }
            >
              發起討論
            </Button>
          )}
        </Stack>
      </Stack>
      {query.isLoading ? (
        <StorytellerLoading label="正在載入討論..." />
      ) : threads.length === 0 ? (
        <CustomEmptyState
          icon={<ForumOutlinedIcon fontSize="large" />}
          title="還沒有討論"
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 1, overflow: "hidden" }}>
          <DiscussionThreadList
            threads={threads}
            context={context}
            showAnchor
            initialExpanded={searchParams.get("thread") ?? undefined}
            onNotify={feedback.notify}
            onLoginRequired={feedback.askLogin}
          />
          {query.hasNextPage && (
            <Box
              sx={{
                p: 1.5,
                textAlign: "center",
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <Button
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                載入更多
              </Button>
            </Box>
          )}
        </Paper>
      )}
      {creating && (
        <NewDiscussionDialog
          open
          context={context}
          anchor={{ kind: "pick" }}
          asOptions={viewer?.as ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => setCreating(false)}
          onNotify={feedback.notify}
        />
      )}
      <LoginPromptDialog
        open={feedback.loginOpen}
        onClose={feedback.closeLogin}
        description="參與討論需要登入。是否要現在登入？"
      />
      <CustomSnackbar {...feedback.snackProps} />
    </Stack>
  );
}
