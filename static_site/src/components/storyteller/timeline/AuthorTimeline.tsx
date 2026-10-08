import DynamicFeedOutlinedIcon from "@mui/icons-material/DynamicFeedOutlined";
import { Box, Button, Divider, Paper, Stack } from "@mui/material";
import { Fragment } from "react";
import { useAuthorPosts } from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerAuthorIdentity } from "@/types/storyteller.ts";
import { AuthorPostCard } from "./AuthorPostCard.tsx";
import { AuthorPostComposer } from "./AuthorPostComposer.tsx";

type Notify = (message: string, severity?: "success" | "error") => void;

// 作者頁「動態」分頁：擁有者有發文框；每個身份各自一條時間軸（本人頁不會出現筆名的動態）。
export function AuthorTimeline({
  author,
  isOwner,
  onNotify,
  onLoginRequired,
}: {
  author: StorytellerAuthorIdentity;
  isOwner: boolean;
  onNotify: Notify;
  onLoginRequired: () => void;
}) {
  const { session } = useAuth();
  const query = useAuthorPosts(author.pen_name);
  const posts = query.data?.pages.flatMap((page) => page?.items ?? []) ?? [];

  return (
    <Stack spacing={2}>
      {isOwner && <AuthorPostComposer author={author} onNotify={onNotify} />}
      {query.isLoading ? (
        <StorytellerLoading label="正在載入動態..." />
      ) : posts.length === 0 ? (
        <CustomEmptyState
          icon={<DynamicFeedOutlinedIcon fontSize="large" />}
          title="還沒有動態"
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 1, overflow: "hidden" }}>
          {posts.map((post, index) => (
            <Fragment key={post.public_id}>
              {index > 0 && <Divider />}
              <AuthorPostCard
                post={post}
                onNotify={onNotify}
                onLoginRequired={session ? undefined : onLoginRequired}
              />
            </Fragment>
          ))}
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
    </Stack>
  );
}
