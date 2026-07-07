import ArticleIcon from "@mui/icons-material/Article";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import LinkIcon from "@mui/icons-material/Link";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
  Button,
  Chip,
  Grid,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useDeleteStorytellerProject,
  useDeleteStorytellerLore,
  useDeleteStorytellerStory,
  useStorytellerLores,
  useStorytellerProjects,
  useSaveStorytellerStory,
  useStorytellerStories,
} from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  formatStorytellerDate,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
} from "@/data/storyteller.ts";
import { ConfirmNameDialog } from "@/components/common/ConfirmNameDialog.tsx";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerTagChips } from "@/pages/storyteller/StorytellerTagChips.tsx";
import type { StorytellerLore, StorytellerStory } from "@/types/storyteller.ts";

// 穩定的空陣列參考：查詢尚未回傳資料時（例如登入狀態剛載入、query 被停用）
// 用同一個參考當預設值，避免每次 render 都產生新陣列，觸發下方 useEffect 無限重渲染
const emptyStories: StorytellerStory[] = [];

export default function StorytellerProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orderedStories, setOrderedStories] = useState<StorytellerStory[]>([]);
  const [draggingStoryId, setDraggingStoryId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorytellerStory | null>(
    null,
  );
  const [deleteLoreTarget, setDeleteLoreTarget] =
    useState<StorytellerLore | null>(null);
  const [activeTab, setActiveTab] = useState<"stories" | "lores">("stories");
  const [projectDeleteOpen, setProjectDeleteOpen] = useState(false);
  const [linkMenuAnchor, setLinkMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [copyMessageOpen, setCopyMessageOpen] = useState(false);
  const {
    data: apiProjects = [],
    isPending: apiProjectsPending,
    isFetching: apiProjectsFetching,
  } = useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const project = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
        slug: apiProject.slug,
        description: apiProject.description,
        visibility: apiProject.visibility,
        rating: apiProject.rating,
        tags: apiProject.tags ?? [],
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
  const { data: apiStories = emptyStories, isLoading: apiStoriesLoading } =
    useStorytellerStories(apiProject?.public_id);
  const { data: apiLores = [], isLoading: apiLoresLoading } =
    useStorytellerLores(apiProject?.public_id);
  const saveStory = useSaveStorytellerStory(apiProject?.public_id);
  const deleteStory = useDeleteStorytellerStory(apiProject?.public_id);
  const deleteLore = useDeleteStorytellerLore(apiProject?.public_id);
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

  if (!project && (apiProjectsPending || apiProjectsFetching)) {
    return (
      <StorytellerShell
        title="故事專案"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "故事專案", to: "/storyteller/my/project" },
        ]}
      >
        <StorytellerLoading label="正在載入專案..." />
      </StorytellerShell>
    );
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
                label={storytellerProjectRatingLabel(project.rating)}
                color={storytellerProjectRatingColor(project.rating)}
                variant="outlined"
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
                variant="contained"
                size="small"
                startIcon={<DeleteIcon />}
                onClick={() => setProjectDeleteOpen(true)}
              >
                刪除專案
              </Button>
            </Stack>
          </Stack>
          <StorytellerTagChips tags={project.tags} sx={{ mt: 1.5 }} />
        </Paper>
        <CustomSnackbar
          open={copyMessageOpen}
          message="已複製故事頁連結"
          onClose={() => setCopyMessageOpen(false)}
        />

        {deleteStory.isError && (
          <Typography color="error">
            刪除故事失敗，請確認登入狀態後再試一次。
          </Typography>
        )}
        {deleteLore.isError && (
          <Typography color="error">
            刪除設定集失敗，請確認登入狀態後再試一次。
          </Typography>
        )}

        <Grid container spacing={2}>
          <Grid size={12}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={2}>
                <Tabs
                  value={activeTab}
                  onChange={(_, value: "stories" | "lores") =>
                    setActiveTab(value)
                  }
                >
                  <Tab value="stories" label="故事" />
                  <Tab value="lores" label="設定集" />
                </Tabs>
                {activeTab === "stories" && (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <Typography variant="h6" fontWeight={800}>
                      故事列表
                    </Typography>
                    <Button
                      href={`/storyteller/my/project/${project.id}/story/new`}
                      variant="contained"
                      sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
                    >
                      建立故事
                    </Button>
                  </Stack>
                )}
                {activeTab === "lores" && (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <Typography variant="h6" fontWeight={800}>
                      設定集列表
                    </Typography>
                    <Button
                      href={`/storyteller/my/project/${project.id}/lore/new`}
                      variant="contained"
                      sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
                    >
                      建立設定集
                    </Button>
                  </Stack>
                )}
                {activeTab === "stories" && apiStoriesLoading ? (
                  <StorytellerLoading label="正在載入故事列表..." />
                ) : activeTab === "stories" && orderedStories.length === 0 ? (
                  <CustomEmptyState
                    icon={<ArticleIcon fontSize="large" />}
                    title="尚未建立故事"
                    description="使用上方的「建立故事」開始撰寫第一篇故事。"
                  />
                ) : activeTab === "stories" ? (
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
                              status: item.status,
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
                              sx={{
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 2,
                                overflow: "hidden",
                              }}
                            >
                              {story.summary}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary">
                            {story.word_count.toLocaleString()} 字 ·{" "}
                            {formatStorytellerDate(story.updated_at)}
                          </Typography>
                        </Stack>
                        <Chip
                          size="small"
                          label={
                            story.status === "completed" ? "公開中" : "撰寫中"
                          }
                          color={
                            story.status === "completed" ? "success" : "warning"
                          }
                          variant="outlined"
                        />
                        <Button
                          href={`/storyteller/my/project/${project.id}/story/${story.public_id}`}
                          variant="outlined"
                          size="small"
                        >
                          編輯
                        </Button>
                        <Button
                          color="error"
                          variant="contained"
                          size="small"
                          startIcon={<DeleteIcon />}
                          onClick={() => setDeleteTarget(story)}
                        >
                          刪除
                        </Button>
                      </Stack>
                    </Paper>
                  ))
                ) : apiLoresLoading ? (
                  <StorytellerLoading label="正在載入設定集..." />
                ) : apiLores.length === 0 ? (
                  <CustomEmptyState
                    icon={<MenuBookIcon fontSize="large" />}
                    title="尚未建立設定集"
                    description="使用上方的「建立設定集」記錄世界觀、角色規則與劇本設定。"
                  />
                ) : (
                  apiLores.map((lore) => (
                    <Paper
                      key={lore.public_id}
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 1 }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <MenuBookIcon color="primary" />
                        <Stack sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={800}>{lore.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {lore.word_count.toLocaleString()} 字 ·{" "}
                            {formatStorytellerDate(lore.updated_at)}
                          </Typography>
                        </Stack>
                        <Button
                          href={`/storyteller/my/project/${project.id}/lore/${lore.public_id}`}
                          variant="outlined"
                          size="small"
                        >
                          編輯
                        </Button>
                        <Button
                          color="error"
                          variant="contained"
                          size="small"
                          startIcon={<DeleteIcon />}
                          onClick={() => setDeleteLoreTarget(lore)}
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
      {deleteLoreTarget && (
        <ConfirmNameDialog
          open
          title="刪除設定集"
          description="刪除後會移除這份設定集與其版本資料。請輸入設定集名稱確認。"
          confirmName={deleteLoreTarget.title}
          confirmLabel="刪除設定集"
          loading={deleteLore.isPending}
          onClose={() => setDeleteLoreTarget(null)}
          onConfirm={() =>
            deleteLore.mutate(deleteLoreTarget.public_id, {
              onSuccess: () => setDeleteLoreTarget(null),
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
