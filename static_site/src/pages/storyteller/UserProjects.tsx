import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import { Box, Button, Chip, Grid, Pagination, Stack } from "@mui/material";
import { useState } from "react";
import {
  Link as RouterLink,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  usePublicUserStorytellerProjects,
  useSaveStorytellerAuthorFavorite,
  useStorytellerAuthorFavorite,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog.tsx";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import {
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerUserProjects() {
  const { session } = useAuth();
  const { username } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = 12;

  const { data, isLoading } = usePublicUserStorytellerProjects(
    username,
    page,
    pageSize,
  );
  const authorUserId = data?.author?.user_id;
  const isOwner = Boolean(authorUserId && session?.user.id === authorUserId);
  const authorFavoriteQuery = useStorytellerAuthorFavorite(
    isOwner ? undefined : authorUserId,
  );
  const saveAuthorFavorite = useSaveStorytellerAuthorFavorite(
    isOwner ? undefined : authorUserId,
  );
  const isAuthorFavorited = authorFavoriteQuery.data?.favorited ?? false;

  useTitle(`${username} 的作品 - Storyteller`, {
    path: `/storyteller/user/${username}`,
    robots: "index, follow",
  });

  if (isLoading) {
    return (
      <StorytellerShell
        title={`${username} 的作品`}
        description={""}
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: username || "作者" },
        ]}
      >
        <StorytellerLoading label="正在載入作者作品..." />
      </StorytellerShell>
    );
  }

  const items = (data?.items || []).map((project) => ({
    id: project.public_id,
    name: project.name,
    description: project.description,
    storiesCount: project.stories?.length ?? 0,
    rating: project.rating,
    tags: project.tags ?? [],
    wordCount:
      project.stories?.reduce((total, story) => total + story.word_count, 0) ??
      0,
    updatedAt: project.updated_at,
    path: `/storyteller/story/${project.public_id}-${project.slug}`,
  }));

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <StorytellerShell
      title={`${username} 的作品`}
      description={`由 ${username} 創作的公開故事。`}
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: username || "作者" },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {authorUserId && !isOwner && (
            <Button
              variant={isAuthorFavorited ? "contained" : "outlined"}
              startIcon={
                isAuthorFavorited ? <BookmarkAddedIcon /> : <BookmarkAddIcon />
              }
              disabled={saveAuthorFavorite.isPending}
              onClick={() => {
                if (!session) {
                  setLoginPromptOpen(true);
                  return;
                }
                saveAuthorFavorite.mutate(!isAuthorFavorited);
              }}
            >
              {isAuthorFavorited ? "已收藏作者" : "收藏作者"}
            </Button>
          )}
          <Button component={RouterLink} to="/storyteller" variant="outlined">
            回首頁
          </Button>
        </Stack>
      }
    >
      <LoginPromptDialog
        open={loginPromptOpen}
        onClose={() => setLoginPromptOpen(false)}
        description="收藏作者需要登入。是否要現在登入？"
      />
      {items.length > 0 ? (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            {items.map((project) => (
              <Grid key={project.id} size={{ xs: 12, md: 6, lg: 4 }}>
                <StorytellerProjectCard
                  name={project.name}
                  description={project.description}
                  updatedAt={project.updatedAt}
                  chips={
                    <>
                      <Chip
                        size="small"
                        icon={<LockOpenIcon />}
                        label="公開閱讀"
                      />
                      <Chip
                        size="small"
                        color={storytellerProjectRatingColor(project.rating)}
                        label={storytellerProjectRatingLabel(project.rating)}
                      />
                      <Chip
                        size="small"
                        label={`${project.storiesCount} 篇故事`}
                      />
                      <Chip
                        size="small"
                        label={`${project.wordCount.toLocaleString()} 字`}
                      />
                      {project.tags.map((tag) => (
                        <Chip key={tag} size="small" label={tag} />
                      ))}
                    </>
                  }
                  actions={
                    <Button
                      component={RouterLink}
                      to={project.path}
                      variant="contained"
                    >
                      開始閱讀
                    </Button>
                  }
                />
              </Grid>
            ))}
          </Grid>
          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => {
                  setSearchParams({ page: value.toString() });
                }}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      ) : (
        <CustomEmptyState
          icon={<LockOpenIcon fontSize="large" />}
          title="目前沒有公開的作品"
          description="這位作者公開的 Storyteller 專案會顯示在這裡。"
        />
      )}
    </StorytellerShell>
  );
}
