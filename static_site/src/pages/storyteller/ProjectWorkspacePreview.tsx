import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import {
  Box,
  Button,
  CircularProgress,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  useStorytellerAssetCollections,
  useStorytellerAssets,
  useStorytellerLoreCollections,
  useStorytellerLoresPage,
  useStorytellerProject,
  useStorytellerProjects,
  useStorytellerStories,
  useStorytellerVolumes,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import {
  formatStorytellerDate,
  STORYTELLER_APP_NAME,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import {
  WorkspaceMobileNav,
  WorkspacePane,
  WorkspaceSidebar,
} from "./ProjectWorkspacePreviewComponents.tsx";
import { useWorkspaceListActions } from "./ProjectWorkspacePreviewActions.tsx";
import { EditorPlaceholder } from "./ProjectWorkspacePreviewRows.tsx";
import {
  nodeTitle,
  ungroupedId,
  type SelectedItem,
  type SelectedNode,
  type WorkspaceSection,
} from "./ProjectWorkspacePreviewTypes.ts";

const storyPageSize = 20;
const lorePageSize = 20;
const assetPageSize = 24;

export default function StorytellerProjectWorkspacePreview() {
  const { id } = useParams();
  const { session, loading: authLoading, login, submitting } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [selected, setSelected] = useState<SelectedNode>({
    section: "stories",
    collectionId: "",
  });
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [storyPage, setStoryPage] = useState(1);
  const [lorePage, setLorePage] = useState(1);
  const [assetPage, setAssetPage] = useState(1);
  const [assetKeyword, setAssetKeyword] = useState("");

  const projectQuery = useStorytellerProject(id);
  const projectsQuery = useStorytellerProjects();
  const storiesQuery = useStorytellerStories(id);
  const volumesQuery = useStorytellerVolumes(id);
  const loreCollectionsQuery = useStorytellerLoreCollections(id);
  const assetCollectionsQuery = useStorytellerAssetCollections(id);
  const loresPageQuery = useStorytellerLoresPage(
    selected.section === "lores" ? id : undefined,
    selected.collectionId === ungroupedId ? "" : selected.collectionId,
    lorePage,
    lorePageSize,
  );
  const assetsQuery = useStorytellerAssets(
    selected.section === "assets" ? id : undefined,
    assetPage,
    assetPageSize,
    assetKeyword,
    selected.collectionId === ungroupedId ? "" : selected.collectionId,
  );

  const stories = storiesQuery.data ?? [];
  const volumes = volumesQuery.data ?? [];
  const loreCollections = loreCollectionsQuery.data ?? [];
  const assetCollections = assetCollectionsQuery.data ?? [];
  const project = projectQuery.data;

  const storyRows = useMemo(() => {
    const parentId =
      selected.collectionId && selected.collectionId !== ungroupedId
        ? volumes.find((volume) => volume.public_id === selected.collectionId)
            ?.id
        : null;
    return stories
      .filter((story) => !story.is_volume)
      .filter((story) => {
        if (selected.section !== "stories" || selected.collectionId === "") {
          return true;
        }
        return selected.collectionId === ungroupedId
          ? story.parent_id === null
          : story.parent_id === parentId;
      })
      .sort((left, right) => left.sort - right.sort);
  }, [selected, stories, volumes]);
  const storyTotalPages = Math.max(
    1,
    Math.ceil(storyRows.length / storyPageSize),
  );
  const visibleStoryRows = storyRows.slice(
    (storyPage - 1) * storyPageSize,
    storyPage * storyPageSize,
  );
  const loreTotalPages = Math.max(
    1,
    Math.ceil((loresPageQuery.data?.total_count ?? 0) / lorePageSize),
  );
  const assetTotalPages = Math.max(
    1,
    Math.ceil((assetsQuery.data?.total_count ?? 0) / assetPageSize),
  );

  const activeTitle =
    nodeTitle(selected.section, selected.collectionId) ||
    volumes.find((volume) => volume.public_id === selected.collectionId)
      ?.title ||
    loreCollections.find(
      (collection) => collection.public_id === selected.collectionId,
    )?.name ||
    assetCollections.find(
      (collection) => collection.public_id === selected.collectionId,
    )?.name ||
    "工作台";

  function selectNode(section: WorkspaceSection, collectionId: string) {
    setSelected({ section, collectionId });
    setSelectedItem(null);
    setStoryPage(1);
    setLorePage(1);
    setAssetPage(1);
  }

  const listActions = useWorkspaceListActions({
    projectId: id,
    selected,
    stories,
    volumes,
    loreCollections,
    assetCollections,
    assetKeyword,
    onAssetKeywordChange: (keyword) => {
      setAssetKeyword(keyword);
      setAssetPage(1);
    },
    onSelect: selectNode,
    onRefreshAssets: () => void assetsQuery.refetch(),
  });

  if (authLoading) {
    return (
      <WorkspaceChrome title="工作台">
        <WorkspaceCentered>
          <CircularProgress size={24} />
          <Typography color="text.secondary">確認登入狀態...</Typography>
        </WorkspaceCentered>
      </WorkspaceChrome>
    );
  }
  if (!session) {
    return (
      <WorkspaceChrome title="工作台">
        <WorkspaceCentered>
          <AutoStoriesIcon color="primary" />
          <Box>
            <Typography fontWeight={900}>需要登入</Typography>
            <Typography variant="body2" color="text.secondary">
              登入後才能預覽專案工作台。
            </Typography>
          </Box>
          <Button variant="contained" onClick={() => void login()}>
            {submitting ? "登入中" : "使用 Google 登入"}
          </Button>
        </WorkspaceCentered>
      </WorkspaceChrome>
    );
  }
  if (projectQuery.isLoading) {
    return (
      <WorkspaceChrome title="工作台">
        <WorkspaceCentered>
          <CircularProgress size={24} />
          <Typography color="text.secondary">載入工作台...</Typography>
        </WorkspaceCentered>
      </WorkspaceChrome>
    );
  }

  return (
    <WorkspaceChrome
      title={project?.name ?? "專案"}
      projectId={project?.public_id ?? id}
      projects={projectsQuery.data ?? []}
      action={
        <Button component={RouterLink} to={steamloomPath(`my/project/${id}`)}>
          舊管理頁
        </Button>
      }
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "260px minmax(0, 1fr)" },
          flex: 1,
          minHeight: 0,
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "#191919" : "#ffffff",
        }}
      >
        {!isMobile && (
          <Box
            sx={{
              borderRight: 1,
              borderColor: (theme) =>
                theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
              bgcolor: (theme) =>
                theme.palette.mode === "dark" ? "#202020" : "#f7f7f5",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <WorkspaceSidebar
              selected={selected}
              stories={stories}
              volumes={volumes}
              loreCollections={loreCollections}
              assetCollections={assetCollections}
              onSelect={selectNode}
            />
          </Box>
        )}
        <Box sx={{ minWidth: 0, overflow: "auto" }}>
          {isMobile && (
            <WorkspaceMobileNav
              selected={selected}
              stories={stories}
              volumes={volumes}
              loreCollections={loreCollections}
              assetCollections={assetCollections}
              onSelect={selectNode}
            />
          )}
          <Box
            sx={{
              px: { xs: 2.25, md: 9 },
              py: { xs: 2.5, md: 6 },
              maxWidth: selectedItem ? 1120 : 980,
              mx: "auto",
            }}
          >
            {selectedItem ? (
              <EditorPlaceholder
                item={selectedItem}
                projectId={id ?? ""}
                onBack={() => setSelectedItem(null)}
              />
            ) : (
              <WorkspacePane
                title={activeTitle}
                selected={selected}
                stories={visibleStoryRows}
                lores={loresPageQuery.data?.lores ?? []}
                assets={assetsQuery.data?.assets ?? []}
                loading={
                  storiesQuery.isLoading ||
                  loresPageQuery.isLoading ||
                  assetsQuery.isLoading
                }
                onSelectItem={setSelectedItem}
                actions={listActions.actions}
                titleActions={listActions.titleActions}
                pagination={
                  selected.section === "stories"
                    ? {
                        count: storyTotalPages,
                        page: Math.min(storyPage, storyTotalPages),
                        onChange: setStoryPage,
                      }
                    : selected.section === "lores"
                      ? {
                          count: loreTotalPages,
                          page: Math.min(lorePage, loreTotalPages),
                          onChange: setLorePage,
                        }
                      : {
                          count: assetTotalPages,
                          page: Math.min(assetPage, assetTotalPages),
                          onChange: setAssetPage,
                        }
                }
                renderStoryActions={listActions.renderStoryActions}
                renderLoreActions={listActions.renderLoreActions}
                renderAssetActions={listActions.renderAssetActions}
              />
            )}
          </Box>
        </Box>
      </Box>
      {listActions.dialogs}
    </WorkspaceChrome>
  );
}

function WorkspaceChrome({
  title,
  projectId,
  projects = [],
  action,
  children,
}: {
  title: string;
  projectId?: string;
  projects?: Array<{
    public_id: string;
    name: string;
    slug: string;
    updated_at: string;
  }>;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [projectMenuAnchor, setProjectMenuAnchor] =
    useState<HTMLElement | null>(null);
  const switchableProjects = projects.filter(
    (project) => project.public_id !== projectId,
  );

  function closeProjectMenu() {
    setProjectMenuAnchor(null);
  }

  return (
    <Box
      sx={{
        position: "fixed",
        top: { xs: 56, sm: 64 },
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: (theme) => theme.zIndex.drawer,
        display: "flex",
        flexDirection: "column",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#191919" : "#ffffff",
        color: (theme) =>
          theme.palette.mode === "dark" ? "#f1f1f0" : "#37352f",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{
          px: { xs: 1.5, md: 2 },
          py: 0.75,
          minHeight: 44,
          borderBottom: 1,
          borderColor: (theme) =>
            theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? alpha("#191919", 0.96)
              : alpha("#ffffff", 0.96),
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{ minWidth: 0 }}
        >
          <Typography
            component={RouterLink}
            to={steamloomPath()}
            color="text.secondary"
            sx={{ textDecoration: "none", flexShrink: 0 }}
          >
            {STORYTELLER_APP_NAME}
          </Typography>
          <Typography color="text.secondary" sx={{ flexShrink: 0 }}>
            &gt;
          </Typography>
          <Typography
            component={RouterLink}
            to={steamloomPath("my")}
            color="text.secondary"
            sx={{ textDecoration: "none", flexShrink: 0 }}
          >
            我的工作台
          </Typography>
          <Typography color="text.secondary" sx={{ flexShrink: 0 }}>
            &gt;
          </Typography>
          <Stack
            component={RouterLink}
            to={projectId ? steamloomPath(`my/workspace/${projectId}`) : "#"}
            direction="row"
            alignItems="center"
            spacing={0.25}
            onClick={(event) => {
              if (switchableProjects.length > 0) {
                event.preventDefault();
                setProjectMenuAnchor((current) =>
                  current ? null : event.currentTarget,
                );
              }
            }}
            sx={{
              minWidth: 0,
              color: "primary.main",
              textDecoration: "none",
              fontWeight: 800,
              "&:hover": { color: "primary.dark" },
            }}
          >
            <Typography fontWeight={800} noWrap sx={{ minWidth: 0 }}>
              {title}
            </Typography>
            <Typography
              component="span"
              color="text.secondary"
              sx={{ lineHeight: 1 }}
            >
              ▾
            </Typography>
          </Stack>
        </Stack>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Stack>
      <Menu
        anchorEl={projectMenuAnchor}
        open={Boolean(projectMenuAnchor)}
        onClose={closeProjectMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        disableAutoFocusItem
        MenuListProps={{ dense: true }}
        slotProps={{
          paper: {
            sx: { minWidth: 240, maxWidth: 360 },
          },
        }}
      >
        {switchableProjects.length === 0 ? (
          <MenuItem disabled>沒有其他專案</MenuItem>
        ) : (
          switchableProjects.map((project) => (
            <MenuItem
              key={project.public_id}
              component={RouterLink}
              to={steamloomPath(`my/workspace/${project.public_id}`)}
              onClick={closeProjectMenu}
              sx={{
                borderBottom: 1,
                borderColor: (theme) =>
                  theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
                py: 1,
              }}
            >
              <ListItemText
                primary={project.name}
                secondary={`最後更新 ${formatStorytellerDate(project.updated_at)}`}
                primaryTypographyProps={{ noWrap: true }}
                secondaryTypographyProps={{ noWrap: true }}
              />
            </MenuItem>
          ))
        )}
      </Menu>
      {children}
    </Box>
  );
}

function WorkspaceCentered({ children }: { children: ReactNode }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      textAlign="center"
      sx={{ minHeight: "calc(100vh - 150px)", p: 3 }}
    >
      {children}
    </Stack>
  );
}
