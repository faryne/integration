import ArticleIcon from "@mui/icons-material/Article";
import CollectionsIcon from "@mui/icons-material/Collections";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import LinkIcon from "@mui/icons-material/Link";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  Grid,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  useDeleteStorytellerProject,
  useDeleteStorytellerLore,
  useDeleteStorytellerStory,
  useSaveStorytellerVolume,
  useStorytellerLores,
  useStorytellerProjects,
  useSaveStorytellerStory,
  useStorytellerStories,
  useStorytellerVolumes,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { SteamRivets } from "@/components/storyteller/SteamPanelAccent.tsx";
import {
  formatStorytellerDate,
  STORYTELLER_APP_NAME,
  storytellerProjectRatingColor,
  storytellerProjectRatingLabel,
  storytellerReaderPath,
} from "@/data/storyteller.ts";
import {
  steamPanelTopBarSx,
  steamTabIndicatorSx,
} from "@/data/storytellerTheme.ts";
import { ConfirmNameDialog } from "@/components/common/ConfirmNameDialog.tsx";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { StorytellerTagChips } from "@/pages/storyteller/StorytellerTagChips.tsx";
import { StorytellerVolumeDialog } from "@/pages/storyteller/StorytellerVolumeDialog.tsx";
import {
  deleteImageEpisode,
  listImageEpisodes,
  type StorytellerImageEpisodeMock,
} from "@/pages/storyteller/storytellerImageEpisodeMock.ts";
import { sortedGroup } from "@/pages/storyteller/storytellerVolumes.ts";
import type { StorytellerLore, StorytellerStory } from "@/types/storyteller.ts";

// 穩定的空陣列參考：查詢尚未回傳資料時（例如登入狀態剛載入、query 被停用）
// 用同一個參考當預設值，避免每次 render 都產生新陣列，觸發下方 useEffect 無限重渲染
const emptyStories: StorytellerStory[] = [];
const emptyVolumes: StorytellerStory[] = [];

export default function StorytellerProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading, login, submitting } = useAuth();
  const activeTab: "stories" | "images" | "lores" = location.pathname.endsWith(
    "/lores",
  )
    ? "lores"
    : location.pathname.endsWith("/images")
      ? "images"
      : "stories";
  const [orderedStories, setOrderedStories] = useState<StorytellerStory[]>([]);
  const [orderedVolumes, setOrderedVolumes] = useState<StorytellerStory[]>([]);
  const [draggingStoryId, setDraggingStoryId] = useState<string | null>(null);
  const [draggingVolumeId, setDraggingVolumeId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorytellerStory | null>(
    null,
  );
  const [deleteLoreTarget, setDeleteLoreTarget] =
    useState<StorytellerLore | null>(null);
  // volumeDialogTarget："new" 代表新增冊，StorytellerStory 代表重新命名該冊。
  const [volumeDialogTarget, setVolumeDialogTarget] = useState<
    "new" | StorytellerStory | null
  >(null);
  const [deleteVolumeTarget, setDeleteVolumeTarget] =
    useState<StorytellerStory | null>(null);
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
        contentType: apiProject.content_type,
      }
    : undefined;
  const { data: apiStories = emptyStories, isLoading: apiStoriesLoading } =
    useStorytellerStories(apiProject?.public_id);
  const { data: apiVolumes = emptyVolumes, isLoading: apiVolumesLoading } =
    useStorytellerVolumes(apiProject?.public_id);
  const { data: apiLores = [], isLoading: apiLoresLoading } =
    useStorytellerLores(apiProject?.public_id);
  const saveStory = useSaveStorytellerStory(apiProject?.public_id);
  const saveVolume = useSaveStorytellerVolume(apiProject?.public_id);
  const deleteStory = useDeleteStorytellerStory(apiProject?.public_id);
  const deleteLore = useDeleteStorytellerLore(apiProject?.public_id);
  const deleteProject = useDeleteStorytellerProject();

  useEffect(() => {
    setOrderedStories([...apiStories]);
  }, [apiStories]);

  useEffect(() => {
    setOrderedVolumes(
      [...apiVolumes].sort((left, right) => left.sort - right.sort),
    );
  }, [apiVolumes]);

  const [imageEpisodes, setImageEpisodes] = useState<
    StorytellerImageEpisodeMock[]
  >([]);

  useEffect(() => {
    setImageEpisodes(listImageEpisodes(apiProject?.public_id));
  }, [apiProject?.public_id]);

  function handleDeleteImageEpisode(episodeId: string) {
    deleteImageEpisode(episodeId);
    setImageEpisodes(listImageEpisodes(apiProject?.public_id));
  }

  // handleDropVolume 把拖曳中的冊放到 targetVolumeId 前面（null 代表放到最後），
  // 只重排冊彼此之間的順序，跟故事的 parent_id 無關。
  function handleDropVolume(targetVolumeId: string | null) {
    if (!draggingVolumeId || draggingVolumeId === targetVolumeId) {
      setDraggingVolumeId(null);
      return;
    }
    const draggingIndex = orderedVolumes.findIndex(
      (item) => item.public_id === draggingVolumeId,
    );
    if (draggingIndex < 0) {
      setDraggingVolumeId(null);
      return;
    }
    const nextVolumes = [...orderedVolumes];
    const [draggingVolume] = nextVolumes.splice(draggingIndex, 1);
    const dropIndex = targetVolumeId
      ? nextVolumes.findIndex((item) => item.public_id === targetVolumeId)
      : nextVolumes.length;
    nextVolumes.splice(
      dropIndex < 0 ? nextVolumes.length : dropIndex,
      0,
      draggingVolume,
    );
    setOrderedVolumes(nextVolumes);
    setDraggingVolumeId(null);
    nextVolumes.forEach((item, index) => {
      if (item.sort === index) {
        return;
      }
      saveVolume.mutate({
        volumePublicId: item.public_id,
        input: { title: item.title, sort: index, status: item.status },
      });
    });
  }

  // handleDropStory 把拖曳中的故事放到目標分組（targetVolumeId=null 代表未分冊）的
  // targetStoryId 前面（null 代表放到該分組最後）。只有真的換組的那篇故事會在存檔時
  // 帶上 parent_id；純粹重新排序的故事只送 sort，parent_id 留空代表不更動冊隸屬。
  function handleDropStory(
    targetVolumeId: number | null,
    targetStoryId: string | null,
  ) {
    if (!draggingStoryId || draggingStoryId === targetStoryId) {
      setDraggingStoryId(null);
      return;
    }
    const draggingStory = orderedStories.find(
      (item) => item.public_id === draggingStoryId,
    );
    if (!draggingStory) {
      setDraggingStoryId(null);
      return;
    }
    const sourceVolumeId = draggingStory.parent_id;
    const remaining = orderedStories.filter(
      (item) => item.public_id !== draggingStoryId,
    );
    const targetGroup = sortedGroup(remaining, targetVolumeId);
    const insertIndex = targetStoryId
      ? targetGroup.findIndex((item) => item.public_id === targetStoryId)
      : targetGroup.length;
    targetGroup.splice(
      insertIndex < 0 ? targetGroup.length : insertIndex,
      0,
      draggingStory,
    );

    const changed = new Map<
      string,
      { sort: number; parentId?: number | null }
    >();
    targetGroup.forEach((item, index) => {
      const movedHere = item.public_id === draggingStoryId;
      if (item.sort !== index || movedHere) {
        changed.set(item.public_id, {
          sort: index,
          parentId: movedHere ? targetVolumeId : undefined,
        });
      }
    });
    if (sourceVolumeId !== targetVolumeId) {
      sortedGroup(remaining, sourceVolumeId).forEach((item, index) => {
        if (item.sort !== index) {
          changed.set(item.public_id, { sort: index });
        }
      });
    }

    setOrderedStories((previous) =>
      previous.map((item) => {
        const update = changed.get(item.public_id);
        if (!update) {
          return item;
        }
        return {
          ...item,
          sort: update.sort,
          parent_id:
            update.parentId !== undefined ? update.parentId : item.parent_id,
        };
      }),
    );
    setDraggingStoryId(null);

    changed.forEach((update, storyPublicId) => {
      const item = orderedStories.find((s) => s.public_id === storyPublicId);
      if (!item) {
        return;
      }
      const targetVolume =
        update.parentId !== undefined && update.parentId !== null
          ? apiVolumes.find((volume) => volume.id === update.parentId)
          : undefined;
      saveStory.mutate({
        storyPublicId,
        input: {
          title: item.title,
          summary: item.summary,
          status: item.status,
          sort: update.sort,
          content: item.latest_content,
          ...(update.parentId !== undefined
            ? { parent_id: targetVolume?.public_id ?? "" }
            : {}),
        },
      });
    });
  }

  useTitle(
    project
      ? `${project.name} - ${STORYTELLER_APP_NAME}`
      : `${STORYTELLER_APP_NAME} 專案`,
    {
      path: id
        ? steamloomPath(`my/project/${id}/${activeTab}`)
        : steamloomPath("my/project"),
      robots: "noindex, nofollow",
    },
  );

  const projectShellBreadcrumbs = [
    { label: STORYTELLER_APP_NAME, to: steamloomPath() },
    { label: "我的工作台", to: steamloomPath("my") },
    { label: "創作專案", to: steamloomPath("my/project") },
  ];

  if (loading) {
    return (
      <StorytellerShell title="創作專案" breadcrumbs={projectShellBreadcrumbs}>
        <Stack alignItems="center" sx={{ py: 8 }}>
          <Typography color="text.secondary">正在確認登入狀態...</Typography>
        </Stack>
      </StorytellerShell>
    );
  }

  if (!session) {
    return (
      <StorytellerShell title="創作專案" breadcrumbs={projectShellBreadcrumbs}>
        <CustomLoginRequiredState
          description="登入後即可查看這個創作專案。"
          onLogin={() => void login()}
          submitting={submitting}
        />
      </StorytellerShell>
    );
  }

  if (!project && (apiProjectsPending || apiProjectsFetching)) {
    return (
      <StorytellerShell title="創作專案" breadcrumbs={projectShellBreadcrumbs}>
        <StorytellerLoading label="正在載入專案..." />
      </StorytellerShell>
    );
  }

  if (!project) {
    return <ErrorPage code={404} />;
  }
  const projectId = project.id;

  // renderDropEndZone 補一塊有實際高度的拖放目標，放在每份清單最後一項的後面。
  // 沒有這塊的話，清單的容器範圍會直接貼齊最後一項卡片的下緣，容器本身的
  // onDrop（放到最後）永遠踩不到，使用者只能拖到「插在某一項之前」，
  // 想排到最後得先繞道排到倒數第二再把原本最後一項往前搬。
  function renderDropEndZone(onDrop: () => void) {
    return (
      <Box
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          // 這塊常常嵌在自己也有 onDrop 的容器裡（冊卡片、未分冊故事清單），
          // 不擋掉冒泡的話同一次放開滑鼠會把 handleDropStory／handleDropVolume
          // 疊加執行兩次。
          event.stopPropagation();
          onDrop();
        }}
        sx={{ minHeight: 16 }}
      />
    );
  }

  function renderStoryRow(story: StorytellerStory) {
    return (
      <Paper
        key={story.public_id}
        draggable
        variant="outlined"
        onDragStart={() => {
          setDraggingVolumeId(null);
          setDraggingStoryId(story.public_id);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          // 正在拖曳的是「冊」而不是故事時，不要在這裡吃掉事件——讓它冒泡到
          // 外層冊卡片的 onDrop，才能把冊排到「目前排最前面的那個冊」前面。
          // 不然一個冊只要底下已經有故事，整張卡片幾乎都會被故事列擋住，
          // 拖曳冊排序時完全點不到冊本身能接收 drop 的空隙。
          if (draggingVolumeId) {
            return;
          }
          event.stopPropagation();
          handleDropStory(story.parent_id, story.public_id);
        }}
        sx={{
          p: 2,
          borderRadius: 1,
          cursor: "grab",
          opacity: draggingStoryId === story.public_id ? 0.55 : 1,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Tooltip title="拖放調整故事順序，或拖到別的冊／未分冊區塊">
            <DragIndicatorIcon color="disabled" />
          </Tooltip>
          <ArticleIcon color="primary" />
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={800}>{story.title}</Typography>
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
          <Tooltip
            title={
              story.status === "completed"
                ? "公開中，點一下改為未公開"
                : "未公開，點一下改為公開中"
            }
          >
            <FormControlLabel
              sx={{ mr: 0 }}
              control={
                <Switch
                  size="small"
                  color="success"
                  checked={story.status === "completed"}
                  disabled={saveStory.isPending}
                  onChange={(event) =>
                    saveStory.mutate({
                      storyPublicId: story.public_id,
                      input: {
                        title: story.title,
                        summary: story.summary,
                        status: event.target.checked ? "completed" : "draft",
                        sort: story.sort,
                        content: story.latest_content,
                      },
                    })
                  }
                />
              }
              label={story.status === "completed" ? "公開中" : "未公開"}
            />
          </Tooltip>
          <Button
            href={steamloomPath(
              `my/project/${projectId}/story/${story.public_id}`,
            )}
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
    );
  }

  const readerUrl =
    project.visibility === "unlisted" && project.shareToken
      ? steamloomPath(`work/share/${project.shareToken}`)
      : storytellerReaderPath(
          {
            public_id: project.id,
            slug: project.slug,
            content_type: project.contentType,
          },
          apiStories.length,
          imageEpisodes.length,
        );
  const readerUrlLabel =
    project.visibility === "unlisted" ? "親友分享連結" : "作品頁連結";
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
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        { label: "我的工作台", to: steamloomPath("my") },
        { label: "創作專案", to: steamloomPath("my/project") },
        {
          label: project.name,
          to: steamloomPath(`my/project/${project.id}`),
        },
        {
          label:
            activeTab === "lores"
              ? "設定集"
              : activeTab === "images"
                ? "圖像與冊"
                : "故事與冊",
        },
      ]}
    >
      <Stack spacing={3}>
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 1, ...steamPanelTopBarSx }}
        >
          <SteamRivets inset={7} />
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
              <Chip
                size="small"
                variant="outlined"
                icon={
                  project.contentType === "image" ? (
                    <CollectionsIcon />
                  ) : (
                    <ArticleIcon />
                  )
                }
                label={
                  project.contentType === "image" ? "圖片／漫畫" : "文字故事"
                }
              />
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
                href={steamloomPath(`my/project/${project.id}/edit`)}
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
                  onChange={(_, value: "stories" | "images" | "lores") =>
                    navigate(steamloomPath(`my/project/${project.id}/${value}`))
                  }
                  sx={steamTabIndicatorSx}
                >
                  <Tab value="stories" label="故事與冊" />
                  <Tab value="images" label="圖像與冊" />
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
                      故事與冊
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        startIcon={<CreateNewFolderIcon />}
                        onClick={() => setVolumeDialogTarget("new")}
                        sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
                      >
                        新增冊
                      </Button>
                      <Button
                        href={steamloomPath(
                          `my/project/${project.id}/story/new`,
                        )}
                        variant="contained"
                        sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
                      >
                        建立故事
                      </Button>
                    </Stack>
                  </Stack>
                )}
                {activeTab === "images" && (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <Typography variant="h6" fontWeight={800}>
                      圖像與冊
                    </Typography>
                    <Button
                      href={steamloomPath(`my/project/${project.id}/image/new`)}
                      variant="contained"
                      startIcon={<CollectionsIcon />}
                      sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
                    >
                      上傳圖像作品（Mockup）
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
                      href={steamloomPath(`my/project/${project.id}/lore/new`)}
                      variant="contained"
                      sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
                    >
                      建立設定集
                    </Button>
                  </Stack>
                )}
                {activeTab === "images" && imageEpisodes.length === 0 && (
                  <CustomEmptyState
                    icon={<CollectionsIcon fontSize="large" />}
                    title="尚未建立圖像作品"
                    description="使用上方的「上傳圖像作品」開始建立第一話（目前是 mockup，僅存在這台裝置，尚未串接後端）。"
                  />
                )}
                {activeTab === "images" && imageEpisodes.length > 0 && (
                  <Stack spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      目前是
                      mockup，內容僅存在這台裝置的瀏覽器裡，尚未串接後端。
                    </Typography>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      useFlexGap
                      spacing={1.5}
                    >
                      {imageEpisodes.map((episode) => (
                        <Paper
                          key={episode.id}
                          variant="outlined"
                          sx={{ width: 200, p: 1.5, borderRadius: 1 }}
                        >
                          <Stack spacing={1}>
                            {episode.pageDataUrls[0] ? (
                              <Box
                                component="img"
                                src={episode.pageDataUrls[0]}
                                alt={episode.title}
                                sx={{
                                  width: "100%",
                                  height: 120,
                                  objectFit: "cover",
                                  borderRadius: 0.5,
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: "100%",
                                  height: 120,
                                  borderRadius: 0.5,
                                  bgcolor: "action.hover",
                                }}
                              />
                            )}
                            <Typography variant="body2" fontWeight={700} noWrap>
                              {episode.title}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {episode.pageDataUrls.length} 頁
                            </Typography>
                            <StorytellerTagChips tags={episode.tags} />
                            <Button
                              size="small"
                              variant="outlined"
                              href={steamloomPath(
                                `work/${project.id}-${project.slug}/image/${episode.id}`,
                              )}
                            >
                              閱讀（Mockup）
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() =>
                                handleDeleteImageEpisode(episode.id)
                              }
                            >
                              刪除
                            </Button>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Stack>
                )}
                {activeTab === "stories" &&
                (apiStoriesLoading || apiVolumesLoading) ? (
                  <StorytellerLoading label="正在載入故事列表..." />
                ) : activeTab === "stories" &&
                  orderedStories.length === 0 &&
                  apiVolumes.length === 0 ? (
                  <CustomEmptyState
                    icon={<ArticleIcon fontSize="large" />}
                    title="尚未建立故事"
                    description="使用上方的「建立故事」開始撰寫第一篇故事。"
                  />
                ) : activeTab === "stories" ? (
                  <Stack spacing={2}>
                    {apiVolumes.length > 0 && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <MenuBookIcon fontSize="small" color="primary" />
                        <Typography variant="subtitle2" color="text.secondary">
                          冊
                        </Typography>
                      </Stack>
                    )}
                    {apiVolumes.length > 0 &&
                      renderDropEndZone(() => {
                        if (draggingVolumeId) {
                          handleDropVolume(
                            orderedVolumes[0]?.public_id ?? null,
                          );
                        }
                      })}
                    {orderedVolumes.map((volume) => {
                      const children = sortedGroup(orderedStories, volume.id);
                      return (
                        <Paper
                          key={volume.public_id}
                          variant="outlined"
                          sx={{
                            p: 2,
                            borderRadius: 1,
                            borderStyle: "dashed",
                            opacity:
                              draggingVolumeId === volume.public_id ? 0.55 : 1,
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (draggingVolumeId) {
                              handleDropVolume(volume.public_id);
                            } else {
                              handleDropStory(volume.id, null);
                            }
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            justifyContent="space-between"
                            flexWrap="wrap"
                            useFlexGap
                            draggable
                            onDragStart={() => {
                              setDraggingStoryId(null);
                              setDraggingVolumeId(volume.public_id);
                            }}
                            sx={{ cursor: "grab" }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Tooltip title="拖放調整冊的順序">
                                <DragIndicatorIcon color="disabled" />
                              </Tooltip>
                              <MenuBookIcon color="primary" />
                              <Typography fontWeight={800}>
                                {volume.title}
                              </Typography>
                              <Chip
                                size="small"
                                label={`${children.length} 篇`}
                              />
                            </Stack>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Tooltip
                                title={
                                  volume.status === "completed"
                                    ? "公開中，點一下改為未公開（底下故事會一併隱藏）"
                                    : "未公開，底下故事目前一律不對外顯示，點一下改為公開中"
                                }
                              >
                                <FormControlLabel
                                  sx={{ mr: 0 }}
                                  control={
                                    <Switch
                                      size="small"
                                      color="success"
                                      checked={volume.status === "completed"}
                                      disabled={saveVolume.isPending}
                                      onChange={(event) =>
                                        saveVolume.mutate({
                                          volumePublicId: volume.public_id,
                                          input: {
                                            title: volume.title,
                                            sort: volume.sort,
                                            status: event.target.checked
                                              ? "completed"
                                              : "draft",
                                          },
                                        })
                                      }
                                    />
                                  }
                                  label={
                                    volume.status === "completed"
                                      ? "公開中"
                                      : "未公開"
                                  }
                                />
                              </Tooltip>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<DriveFileRenameOutlineIcon />}
                                onClick={() => setVolumeDialogTarget(volume)}
                              >
                                重新命名
                              </Button>
                              <Tooltip
                                title={
                                  children.length > 0
                                    ? "冊非空不能刪除，請先移出底下的故事"
                                    : ""
                                }
                              >
                                <span>
                                  <Button
                                    size="small"
                                    color="error"
                                    variant="contained"
                                    startIcon={<DeleteIcon />}
                                    disabled={children.length > 0}
                                    onClick={() =>
                                      setDeleteVolumeTarget(volume)
                                    }
                                  >
                                    刪除
                                  </Button>
                                </span>
                              </Tooltip>
                            </Stack>
                          </Stack>
                          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                            {children.length > 0 &&
                              renderDropEndZone(() => {
                                if (draggingVolumeId) {
                                  handleDropVolume(volume.public_id);
                                } else {
                                  handleDropStory(
                                    volume.id,
                                    children[0]?.public_id ?? null,
                                  );
                                }
                              })}
                            {children.length === 0 ? (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontStyle: "italic" }}
                              >
                                拖曳故事到這裡加入這一冊。
                              </Typography>
                            ) : (
                              children.map((story) => renderStoryRow(story))
                            )}
                            {renderDropEndZone(() => {
                              if (draggingVolumeId) {
                                handleDropVolume(volume.public_id);
                              } else {
                                handleDropStory(volume.id, null);
                              }
                            })}
                          </Stack>
                        </Paper>
                      );
                    })}
                    {apiVolumes.length > 0 &&
                      renderDropEndZone(() => {
                        if (draggingVolumeId) {
                          handleDropVolume(null);
                        }
                      })}
                    {apiVolumes.length > 0 && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <ArticleIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" color="text.secondary">
                          未分冊故事
                        </Typography>
                      </Stack>
                    )}
                    <Stack
                      spacing={1.5}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleDropStory(null, null)}
                      sx={{ minHeight: 8 }}
                    >
                      {(() => {
                        const ungrouped = sortedGroup(orderedStories, null);
                        return (
                          <>
                            {ungrouped.length === 0 &&
                              apiVolumes.length > 0 && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ fontStyle: "italic" }}
                                >
                                  未分冊故事會顯示在這裡，可拖曳到上方的冊中。
                                </Typography>
                              )}
                            {ungrouped.length > 0 &&
                              renderDropEndZone(() =>
                                handleDropStory(
                                  null,
                                  ungrouped[0]?.public_id ?? null,
                                ),
                              )}
                            {ungrouped.map((story) => renderStoryRow(story))}
                          </>
                        );
                      })()}
                      {renderDropEndZone(() => handleDropStory(null, null))}
                    </Stack>
                  </Stack>
                ) : activeTab === "lores" && apiLoresLoading ? (
                  <StorytellerLoading label="正在載入設定集..." />
                ) : activeTab === "lores" && apiLores.length === 0 ? (
                  <CustomEmptyState
                    icon={<MenuBookIcon fontSize="large" />}
                    title="尚未建立設定集"
                    description="使用上方的「建立設定集」記錄世界觀、角色規則與劇本設定。"
                  />
                ) : activeTab === "lores" ? (
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
                          href={steamloomPath(
                            `my/project/${project.id}/lore/${lore.public_id}`,
                          )}
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
                ) : null}
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
      <StorytellerVolumeDialog
        open={volumeDialogTarget !== null}
        initialTitle={
          volumeDialogTarget && volumeDialogTarget !== "new"
            ? volumeDialogTarget.title
            : undefined
        }
        loading={saveVolume.isPending}
        onClose={() => setVolumeDialogTarget(null)}
        onSubmit={(title) =>
          saveVolume.mutate(
            {
              volumePublicId:
                volumeDialogTarget && volumeDialogTarget !== "new"
                  ? volumeDialogTarget.public_id
                  : undefined,
              input: {
                title,
                sort:
                  volumeDialogTarget && volumeDialogTarget !== "new"
                    ? volumeDialogTarget.sort
                    : apiVolumes.length,
                status:
                  volumeDialogTarget && volumeDialogTarget !== "new"
                    ? volumeDialogTarget.status
                    : "completed",
              },
            },
            { onSuccess: () => setVolumeDialogTarget(null) },
          )
        }
      />
      {deleteVolumeTarget && (
        <ConfirmNameDialog
          open
          title="刪除冊"
          description="刪除後無法復原。請輸入冊名稱確認。"
          confirmName={deleteVolumeTarget.title}
          confirmLabel="刪除冊"
          loading={deleteStory.isPending}
          onClose={() => setDeleteVolumeTarget(null)}
          onConfirm={() =>
            deleteStory.mutate(deleteVolumeTarget.public_id, {
              onSuccess: () => setDeleteVolumeTarget(null),
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
              onSuccess: () => navigate(steamloomPath("my/project")),
            })
          }
        />
      )}
    </StorytellerShell>
  );
}
