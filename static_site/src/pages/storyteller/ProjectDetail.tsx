import ArticleIcon from "@mui/icons-material/Article";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import LinkIcon from "@mui/icons-material/Link";
import {
  Button,
  Chip,
  Grid,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useDeleteStorytellerProject,
  useDeleteStorytellerStory,
  useStorytellerProjects,
  useSaveStorytellerStory,
  useStorytellerStories,
} from "@/apis/storyteller.ts";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { ConfirmNameDialog } from "@/components/common/ConfirmNameDialog.tsx";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerStory } from "@/types/storyteller.ts";

export default function StorytellerProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orderedStories, setOrderedStories] = useState<StorytellerStory[]>([]);
  const [draggingStoryId, setDraggingStoryId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorytellerStory | null>(
    null,
  );
  const [projectDeleteOpen, setProjectDeleteOpen] = useState(false);
  const [linkMenuAnchor, setLinkMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [copyMessageOpen, setCopyMessageOpen] = useState(false);
  const { data: apiProjects = [], isPending: apiProjectsPending } =
    useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const project = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
        slug: apiProject.slug,
        description: apiProject.description,
        visibility: apiProject.visibility,
        shareToken: apiProject.share_token,
        statusLabel:
          apiProject.visibility === "public"
            ? "已公開"
            : apiProject.visibility === "unlisted"
              ? "與親友分享"
              : "完全不公開",
        storiesCount: apiProject.stories?.length ?? 0,
        updatedAt: apiProject.updated_at,
      }
    : undefined;
  const { data: apiStories = [], isLoading: apiStoriesLoading } =
    useStorytellerStories(apiProject?.public_id);
  const saveStory = useSaveStorytellerStory(apiProject?.public_id);
  const deleteStory = useDeleteStorytellerStory(apiProject?.public_id);
  const deleteProject = useDeleteStorytellerProject();

  useEffect(() => {
    setOrderedStories(
      [...apiStories].sort((left, right) => left.sort - right.sort),
    );
  }, [apiStories]);

  useTitle(project ? `${project.name} - Storyteller` : "Storyteller 專案", {
    path: id ? `/storyteller/my/project/${id}` : "/storyteller/my/project",
    robots: "noindex, nofollow",
  });

  if (!project && apiProjectsPending) {
    return <StorytellerLoading label="正在載入專案..." />;
  }

  if (!project) {
    return <ErrorPage code={404} />;
  }

  const readerUrl =
    project.visibility === "unlisted" && project.shareToken
      ? `/storyteller/story/share/${project.shareToken}`
      : `/storyteller/story/${project.id}-${project.slug}`;
  const readerUrlLabel =
    project.visibility === "unlisted" ? "親友分享連結" : "故事頁連結";
  const absoluteReaderUrl =
    typeof window === "undefined"
      ? readerUrl
      : new URL(readerUrl, window.location.origin).toString();

  async function copyReaderUrl() {
    try {
      await navigator.clipboard.writeText(absoluteReaderUrl);
      setCopyMessageOpen(true);
    } finally {
      setLinkMenuAnchor(null);
    }
  }

  return (
    <StorytellerShell
      title={project.name}
      description={project.description}
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "故事專案", to: "/storyteller/my/project" },
        { label: project.name },
      ]}
      action={
        <Button
          href={`/storyteller/my/project/${project.id}/story/new`}
          variant="contained"
        >
          建立故事
        </Button>
      }
    >
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LinkIcon />}
                onClick={(event) => setLinkMenuAnchor(event.currentTarget)}
              >
                {readerUrlLabel}
              </Button>
              <Menu
                anchorEl={linkMenuAnchor}
                open={Boolean(linkMenuAnchor)}
                onClose={() => setLinkMenuAnchor(null)}
              >
                <MenuItem onClick={() => void copyReaderUrl()}>
                  複製到剪貼簿
                </MenuItem>
                <MenuItem
                  component="a"
                  href={readerUrl}
                  onClick={() => setLinkMenuAnchor(null)}
                >
                  前往
                </MenuItem>
              </Menu>
              <Chip label={project.statusLabel} color="primary" />
              <Chip
                label={`${orderedStories.length || project.storiesCount} 篇故事`}
              />
              <Chip
                label={`更新於 ${formatStorytellerDate(project.updatedAt)}`}
              />
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              justifyContent={{ xs: "flex-start", md: "flex-end" }}
            >
              <Button
                href={`/storyteller/my/project/${project.id}/edit`}
                variant="outlined"
                size="small"
              >
                編輯專案
              </Button>
              <Button
                color="error"
                variant="outlined"
                size="small"
                startIcon={<DeleteIcon />}
                onClick={() => setProjectDeleteOpen(true)}
              >
                刪除專案
              </Button>
            </Stack>
          </Stack>
        </Paper>
        <Snackbar
          open={copyMessageOpen}
          autoHideDuration={2000}
          message="已複製故事頁連結"
          onClose={() => setCopyMessageOpen(false)}
        />

        {deleteStory.isError && (
          <Typography color="error">
            刪除故事失敗，請確認登入狀態後再試一次。
          </Typography>
        )}

        <Grid container spacing={2}>
          <Grid size={12}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={800}>
                  故事列表
                </Typography>
                {apiStoriesLoading ? (
                  <StorytellerLoading label="正在載入故事列表..." />
                ) : (
                  orderedStories.map((story) => (
                    <Paper
                      key={story.public_id}
                      draggable
                      variant="outlined"
                      onDragStart={() => setDraggingStoryId(story.public_id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (
                          !draggingStoryId ||
                          draggingStoryId === story.public_id
                        ) {
                          return;
                        }
                        const draggingIndex = orderedStories.findIndex(
                          (item) => item.public_id === draggingStoryId,
                        );
                        const dropIndex = orderedStories.findIndex(
                          (item) => item.public_id === story.public_id,
                        );
                        if (draggingIndex < 0 || dropIndex < 0) {
                          return;
                        }
                        const nextStories = [...orderedStories];
                        const [draggingStory] = nextStories.splice(
                          draggingIndex,
                          1,
                        );
                        nextStories.splice(dropIndex, 0, draggingStory);
                        setOrderedStories(nextStories);
                        setDraggingStoryId(null);
                        nextStories.forEach((item, index) => {
                          if (item.sort === index) {
                            return;
                          }
                          saveStory.mutate({
                            storyPublicId: item.public_id,
                            input: {
                              title: item.title,
                              summary: item.summary,
                              sort: index,
                              content: item.latest_content,
                            },
                          });
                        });
                      }}
                      sx={{
                        p: 2,
                        borderRadius: 1,
                        cursor: "grab",
                        opacity: draggingStoryId === story.public_id ? 0.55 : 1,
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Tooltip title="拖放調整故事順序">
                          <DragIndicatorIcon color="disabled" />
                        </Tooltip>
                        <ArticleIcon color="primary" />
                        <Stack sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={800}>
                            {story.title}
                          </Typography>
                          {story.summary.trim() && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ overflowWrap: "anywhere" }}
                            >
                              {story.summary}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary">
                            {story.word_count.toLocaleString()} 字 ·{" "}
                            {formatStorytellerDate(story.updated_at)}
                          </Typography>
                        </Stack>
                        <Button
                          href={`/storyteller/my/project/${project.id}/story/${story.public_id}`}
                          variant="outlined"
                          size="small"
                        >
                          編輯
                        </Button>
                        <Button
                          color="error"
                          variant="outlined"
                          size="small"
                          startIcon={<DeleteIcon />}
                          onClick={() => setDeleteTarget(story)}
                        >
                          刪除
                        </Button>
                      </Stack>
                    </Paper>
                  ))
                )}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
      {deleteTarget && (
        <ConfirmNameDialog
          open
          title="刪除故事"
          description="刪除後會移除這篇故事與其版本資料。請輸入故事名稱確認。"
          confirmName={deleteTarget.title}
          confirmLabel="刪除故事"
          loading={deleteStory.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() =>
            deleteStory.mutate(deleteTarget.public_id, {
              onSuccess: () => setDeleteTarget(null),
            })
          }
        />
      )}
      {projectDeleteOpen && (
        <ConfirmNameDialog
          open
          title="刪除專案"
          description="刪除後會移除專案與底下故事資料。請輸入專案名稱確認。"
          confirmName={project.name}
          confirmLabel="刪除專案"
          loading={deleteProject.isPending}
          onClose={() => setProjectDeleteOpen(false)}
          onConfirm={() =>
            deleteProject.mutate(project.id, {
              onSuccess: () => navigate("/storyteller/my/project"),
            })
          }
        />
      )}
    </StorytellerShell>
  );
}
